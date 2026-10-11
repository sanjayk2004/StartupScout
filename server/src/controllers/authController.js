import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { sessionCookieName } from '../middleware/authenticate.js';
import { validateFounderRegistration, validateInvestorRegistration, validateLogin } from '../validators/auth.js';

const SALT_ROUNDS = 12;
const SESSION_TTL_MS = 60 * 60 * 1000;

const asyncRoute = (handler) => (req, res, next) => Promise.resolve(handler(req, res, next)).catch(next);

function publicUser(user) {
  return { id: String(user.id || user._id), displayName: user.displayName, email: user.email, role: user.role };
}

function setSessionCookie(res, token, production) {
  res.cookie(sessionCookieName, token, {
    httpOnly: true,
    secure: production,
    sameSite: 'lax',
    maxAge: SESSION_TTL_MS,
    path: '/',
  });
}

function makeToken(user, jwtSecret) {
  if (Buffer.byteLength(jwtSecret || '', 'utf8') < 32) {
    throw Object.assign(new Error('Authentication is not configured.'), { statusCode: 503 });
  }
  return jwt.sign({ role: user.role }, jwtSecret, {
    algorithm: 'HS256',
    subject: String(user.id || user._id),
    issuer: 'startupconnect',
    expiresIn: '1h',
  });
}

export function createAuthController({ userModel, startupModel, jwtSecret, production = false }) {
  const register = (role, validator) => asyncRoute(async (req, res) => {
    const { value, errors } = validator(req.body || {});
    if (Object.keys(errors).length) return res.status(400).json({ error: { message: 'Registration details are invalid.', fields: errors } });

    let user;
    try {
      const passwordHash = await bcrypt.hash(value.password, SALT_ROUNDS);
      user = await userModel.create({
        displayName: value.displayName,
        email: value.email,
        passwordHash,
        role,
        ...(role === 'investor' ? { investorProfile: value.profile } : { founderProfile: value.profile }),
      });
    } catch (error) {
      if (error.code === 11000) return res.status(409).json({ error: { message: 'An account with this email already exists.' } });
      throw error;
    }

    if (role === 'founder') {
      let startup;
      const userId = String(user.id || user._id);
      try {
        startup = await startupModel.create({ ...value.startup, owner: userId, moderationStatus: 'pending' });
        await userModel.findByIdAndUpdate(userId, { $set: { primaryStartup: startup._id || startup.id } }, { new: true });
      } catch (error) {
        if (startup) await startupModel.deleteOne({ _id: startup._id || startup.id });
        await userModel.deleteOne({ _id: userId });
        throw error;
      }
    }

    const token = makeToken(user, jwtSecret);
    setSessionCookie(res, token, production);
    return res.status(201).json({ data: { user: publicUser(user) } });
  });

  return {
    registerInvestor: register('investor', validateInvestorRegistration),
    registerFounder: register('founder', validateFounderRegistration),
    login: asyncRoute(async (req, res) => {
      const { value, errors } = validateLogin(req.body || {});
      if (Object.keys(errors).length) return res.status(400).json({ error: { message: 'Login details are invalid.', fields: errors } });
      const query = userModel.findOne({ email: value.email });
      const user = await query.select('+passwordHash');
      const passwordMatches = user ? await bcrypt.compare(value.password, user.passwordHash) : false;
      if (!user || !passwordMatches || user.accountStatus === 'suspended' || (value.role && value.role !== user.role)) {
        return res.status(401).json({ error: { message: 'Email or password is incorrect.' } });
      }
      const token = makeToken(user, jwtSecret);
      setSessionCookie(res, token, production);
      return res.json({ data: { user: publicUser(user) } });
    }),
    logout: asyncRoute(async (req, res) => {
      res.clearCookie(sessionCookieName, { httpOnly: true, secure: production, sameSite: 'lax', path: '/' });
      return res.status(204).end();
    }),
    me: asyncRoute(async (req, res) => res.json({ data: { user: req.user } })),
  };
}
