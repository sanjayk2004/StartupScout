import jwt from 'jsonwebtoken';

export const sessionCookieName = 'startupconnect_session';

export function createAuthenticate({ userModel, jwtSecret, optional = false }) {
  return async function authenticate(req, res, next) {
    try {
      const token = req.cookies?.[sessionCookieName] || readCookie(req.headers.cookie, sessionCookieName);
      if (!token) return optional ? next() : res.status(401).json({ error: { message: 'Authentication required.' } });
      const payload = jwt.verify(token, jwtSecret, { algorithms: ['HS256'] });
      const user = await userModel.findById(payload.sub);
      if (!user || user.role !== payload.role || user.accountStatus === 'suspended') return optional ? next() : res.status(401).json({ error: { message: 'Authentication required.' } });
      req.user = { id: String(user.id || user._id), role: user.role, displayName: user.displayName, email: user.email };
      return next();
    } catch {
      return optional ? next() : res.status(401).json({ error: { message: 'Authentication required.' } });
    }
  };
}

function readCookie(header = '', cookieName) {
  for (const part of header.split(';')) {
    const separator = part.indexOf('=');
    if (separator < 0) continue;
    if (part.slice(0, separator).trim() === cookieName) return decodeURIComponent(part.slice(separator + 1).trim());
  }
  return '';
}
