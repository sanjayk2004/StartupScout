import assert from 'node:assert/strict';
import bcrypt from 'bcryptjs';
import { after, before, test } from 'node:test';
import { makeStartupModel } from '../test-support/startupTestServer.js';
import { createApp } from '../src/app.js';
import { validateInvestorRegistration } from '../src/validators/auth.js';

const jwtSecret = 'test-secret-only-never-used-outside-tests-123456';
const investorRegistration = {
  fullName: 'Avery Investor',
  email: 'Avery@Example.com',
  password: 'a-strong-password-42',
  confirmPassword: 'a-strong-password-42',
  investorType: 'angel',
  investmentThesis: 'I support early teams building practical health products.',
  industriesOfInterest: ['Health', 'Climate'],
  preferredFundingStages: ['Pre-seed', 'Seed'],
  investmentRange: { min: 25000, max: 250000, currency: 'USD' },
  preferredStartupLocations: ['India', 'United States'],
};

const founderRegistration = {
  fullName: 'Morgan Founder',
  email: 'morgan@example.com',
  password: 'another-strong-password-42',
  confirmPassword: 'another-strong-password-42',
  founderDesignation: 'Chief Executive Officer',
  phone: '+91 90000 00000',
  city: 'Pune',
  country: 'India',
  annualTurnover: 250000,
  turnoverCurrency: 'INR',
  financialYear: '2025-26',
  fundingRaised: 50000,
  startup: {
    name: 'Northstar Health',
    industry: 'Health',
    description: 'A care coordination platform for underserved communities.',
    location: 'Pune, India',
    fundingStage: 'Seed',
    fundingGoal: 1200000,
    foundedYear: 2022,
    website: 'northstar.example',
    teamSize: 8,
    businessModel: 'Subscription',
    targetMarket: 'Clinics serving rural communities',
    productName: 'Northstar Care',
    productDescription: 'Care coordination for local providers.',
  },
};

function makeUserModel() {
  const users = [];
  return {
    users,
    findOne(filter) {
      return { select: async () => users.find((user) => user.email === filter.email) || null };
    },
    async findById(id) { return users.find((user) => user._id === id) || null; },
    async findByIdAndUpdate(id, update) {
      const user = users.find((record) => record._id === id);
      if (!user) return null;
      Object.assign(user, update.$set || update);
      return { ...user };
    },
    async deleteOne(filter) {
      const index = users.findIndex((user) => user._id === filter._id);
      if (index < 0) return { deletedCount: 0 };
      users.splice(index, 1);
      return { deletedCount: 1 };
    },
    async create(value) {
      if (users.some((user) => user.email === value.email)) throw Object.assign(new Error('Duplicate key.'), { code: 11000 });
      const user = { ...value, _id: `${users.length + 1}`.padStart(24, '0') };
      users.push(user);
      return { ...user };
    },
  };
}

let server;
let baseUrl;
let userModel;
let startupModel;

before(async () => {
  userModel = makeUserModel();
  startupModel = makeStartupModel();
  server = createApp({ userModel, startupModel, jwtSecret }).listen(0, '127.0.0.1');
  await new Promise((resolve) => server.once('listening', resolve));
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});

after(async () => new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve())));

test('investor registration validates investor fields, hashes the password, and sets a secure session cookie', async () => {
  const response = await fetch(`${baseUrl}/api/auth/register/investor`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(investorRegistration),
  });
  assert.equal(response.status, 201);
  const result = await response.json();
  assert.equal(result.data.user.email, 'avery@example.com');
  assert.equal(result.data.user.role, 'investor');
  assert.equal('passwordHash' in result.data.user, false);
  assert.equal('confirmPassword' in result.data.user, false);
  assert.equal('investorProfile' in result.data.user, false);
  assert.equal(userModel.users[0].investorProfile.investorType, 'angel');
  assert.equal('confirmPassword' in userModel.users[0], false);
  assert.notEqual(userModel.users[0].passwordHash, investorRegistration.password);
  assert.equal(await bcrypt.compare(investorRegistration.password, userModel.users[0].passwordHash), true);
  assert.match(response.headers.get('set-cookie'), /HttpOnly/i);
  assert.match(response.headers.get('set-cookie'), /SameSite=Lax/i);
});

test('founder registration creates a private founder profile and one pending owner-linked startup', async () => {
  const response = await fetch(`${baseUrl}/api/auth/register/founder`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(founderRegistration),
  });
  assert.equal(response.status, 201);
  const result = await response.json();
  assert.equal(result.data.user.role, 'founder');
  assert.equal('founderProfile' in result.data.user, false);
  const founder = userModel.users.find((user) => user.role === 'founder');
  const startup = startupModel.records[0];
  assert.equal(founder.founderProfile.annualTurnover, 250000);
  assert.equal(founder.founderProfile.financialYear, '2025-26');
  assert.equal(founder.primaryStartup, startup._id);
  assert.equal(startup.owner, founder._id);
  assert.equal(startup.name, founderRegistration.startup.name);
  assert.equal(startup.moderationStatus, 'pending');
  assert.equal(startup.annualTurnover, undefined);
});

test('login verifies the stored role and sessions remain protected', async () => {
  const response = await fetch(`${baseUrl}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'morgan@example.com', password: founderRegistration.password, role: 'founder' }),
  });
  assert.equal(response.status, 200);
  const cookie = response.headers.get('set-cookie').split(';')[0];
  const me = await fetch(`${baseUrl}/api/auth/me`, { headers: { Cookie: cookie } });
  assert.equal(me.status, 200);
  assert.equal((await me.json()).data.user.role, 'founder');

  const wrongRole = await fetch(`${baseUrl}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'morgan@example.com', password: founderRegistration.password, role: 'investor' }),
  });
  assert.equal(wrongRole.status, 401);
  assert.equal((await wrongRole.json()).error.message, 'Email or password is incorrect.');
  assert.equal((await fetch(`${baseUrl}/api/auth/me`)).status, 401);
});

test('registration validation, duplicate accounts, and public admin role assignment are rejected safely', async () => {
  const countBeforeInvalid = userModel.users.length;
  const invalidInvestor = await fetch(`${baseUrl}/api/auth/register/investor`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...investorRegistration, investmentRange: { min: 500, max: 100, currency: 'USD' } }),
  });
  assert.equal(invalidInvestor.status, 400);
  assert.ok((await invalidInvestor.json()).error.fields['investmentRange.max']);
  assert.equal(userModel.users.length, countBeforeInvalid);

  const invalidFounder = await fetch(`${baseUrl}/api/auth/register/founder`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...founderRegistration, startup: { ...founderRegistration.startup, fundingStage: 'IPO' } }),
  });
  assert.equal(invalidFounder.status, 400);
  assert.ok((await invalidFounder.json()).error.fields['startup.fundingStage']);

  const publicAdmin = await fetch(`${baseUrl}/api/auth/register/investor`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...investorRegistration, email: 'admin@example.com', role: 'admin' }),
  });
  assert.equal(publicAdmin.status, 400);
  assert.ok((await publicAdmin.json()).error.fields.role);

  const founderAdmin = await fetch(`${baseUrl}/api/auth/register/founder`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...founderRegistration, email: 'admin-founder@example.com', role: 'admin' }),
  });
  assert.equal(founderAdmin.status, 400);
  assert.ok((await founderAdmin.json()).error.fields.role);
  assert.equal(userModel.users.some((user) => user.role === 'admin'), false);

  const genericRegistration = await fetch(`${baseUrl}/api/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...investorRegistration, role: 'admin' }),
  });
  assert.equal(genericRegistration.status, 404);

  const duplicate = await fetch(`${baseUrl}/api/auth/register/investor`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(investorRegistration),
  });
  assert.equal(duplicate.status, 409);
  assert.match((await duplicate.json()).error.message, /already exists/);
});

test('investor registration rejects invalid password bytes, confirmation, and required profile fields without creating accounts', async () => {
  const invalidInputs = [
    { email: 'short-password@example.test', password: 'a'.repeat(11), confirmPassword: 'a'.repeat(11) },
    { email: 'long-password@example.test', password: 'a'.repeat(73), confirmPassword: 'a'.repeat(73) },
    { email: 'mismatch@example.test', password: investorRegistration.password, confirmPassword: 'not-the-same-password' },
    { email: 'no-locations@example.test', preferredStartupLocations: [] },
    { email: 'too-many-locations@example.test', preferredStartupLocations: Array.from({ length: 21 }, (_, index) => `Location ${index + 1}`) },
    { email: 'no-industries@example.test', industriesOfInterest: [] },
    { email: 'no-stages@example.test', preferredFundingStages: [] },
    { email: 'invalid-range@example.test', investmentRange: { min: 500, max: 100, currency: 'USD' } },
  ];
  for (const input of invalidInputs) {
    const { errors } = validateInvestorRegistration({ ...investorRegistration, ...input });
    assert.ok(Object.keys(errors).length > 0, `expected ${input.email} to fail validation`);
  }

  const countBefore = userModel.users.length;
  const response = await fetch(`${baseUrl}/api/auth/register/investor`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...investorRegistration, email: 'short-password@example.test', password: 'a'.repeat(11), confirmPassword: 'a'.repeat(11) }),
  });
  assert.equal(response.status, 400);
  assert.ok((await response.json()).error.fields.password);
  assert.equal(userModel.users.length, countBefore);
});
