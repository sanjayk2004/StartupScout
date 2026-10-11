import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { makeSessionCookie, startStartupTestServer } from '../test-support/startupTestServer.js';

let server;
let baseUrl;
let founder;
let investor;
let otherFounder;
let admin;
let founderCookie;
let investorCookie;
let otherFounderCookie;
let adminCookie;
let startupId;

before(async () => {
  server = await startStartupTestServer();
  baseUrl = server.baseUrl;
  [founder, investor, otherFounder, admin] = await Promise.all([
    server.userModel.create({
      displayName: 'Profile Founder', email: 'profile-founder@example.test', role: 'founder',
      founderProfile: { founderDesignation: 'CEO', annualTurnover: 100000, turnoverCurrency: 'USD', financialYear: '2025-26' },
    }),
    server.userModel.create({
      displayName: 'Profile Investor', email: 'profile-investor@example.test', role: 'investor',
      investorProfile: {
        phone: '+1 555 0100', city: 'Boston', country: 'United States', biography: 'An investor in early health companies.',
        investmentThesis: 'I invest in early teams improving community health outcomes.', investorType: 'angel',
        organizationName: 'North Fund', industriesOfInterest: ['Health', 'Climate'], preferredFundingStages: ['Seed'],
        investmentRange: { min: 25000, max: 250000, currency: 'USD' }, preferredStartupLocations: ['India', 'United States'],
      },
    }),
    server.userModel.create({ displayName: 'Other Founder', email: 'other-founder-profile@example.test', role: 'founder', founderProfile: { founderDesignation: 'Founder' } }),
    server.userModel.create({ displayName: 'Platform Admin', email: 'profile-admin@example.test', role: 'admin' }),
  ]);
  founderCookie = makeSessionCookie(founder);
  investorCookie = makeSessionCookie(investor);
  otherFounderCookie = makeSessionCookie(otherFounder);
  adminCookie = makeSessionCookie(admin);
  const startup = await server.model.create({
    name: 'Profile Startup', industry: 'Health', description: 'A startup profile used to test secure owner-scoped profile routes.',
    location: 'Pune, India', fundingStage: 'Seed', fundingGoal: 500000, foundedYear: 2021,
    owner: founder._id, moderationStatus: 'approved', verificationStatus: 'unverified',
  });
  startupId = startup._id;
  await server.userModel.findByIdAndUpdate(founder._id, { $set: { primaryStartup: startupId } });
});

after(async () => server.close());

test('owners can retrieve and update only their own profile and primary startup', async () => {
  const response = await fetch(`${baseUrl}/api/profiles/me`, { headers: { Cookie: founderCookie } });
  assert.equal(response.status, 200);
  const own = (await response.json()).data;
  assert.equal(own.user.email, founder.email);
  assert.equal(own.user.profile.annualTurnover, 100000);
  assert.equal(own.startup._id, startupId);

  const updatedProfile = await fetch(`${baseUrl}/api/profiles/me`, {
    method: 'PATCH', headers: { 'Content-Type': 'application/json', Cookie: founderCookie },
    body: JSON.stringify({ displayName: 'Founder Updated', annualTurnover: 150000, financialYear: '2026-27' }),
  });
  assert.equal(updatedProfile.status, 200);
  assert.equal((await updatedProfile.json()).data.user.profile.annualTurnover, 150000);

  const forbiddenFields = await fetch(`${baseUrl}/api/profiles/me`, {
    method: 'PATCH', headers: { 'Content-Type': 'application/json', Cookie: founderCookie },
    body: JSON.stringify({ role: 'admin', email: 'attacker@example.test', accountStatus: 'active' }),
  });
  assert.equal(forbiddenFields.status, 400);

  const updateStartup = await fetch(`${baseUrl}/api/profiles/me/startup`, {
    method: 'PATCH', headers: { 'Content-Type': 'application/json', Cookie: founderCookie },
    body: JSON.stringify({ location: 'Mumbai, India', owner: otherFounder._id }),
  });
  assert.equal(updateStartup.status, 200);
  assert.equal((await updateStartup.json()).data.location, 'Mumbai, India');
  assert.equal(server.model.records[0].owner, founder._id);

  await server.userModel.findByIdAndUpdate(otherFounder._id, { $set: { primaryStartup: startupId } });
  const stolenStartup = await fetch(`${baseUrl}/api/profiles/me/startup`, {
    method: 'PATCH', headers: { 'Content-Type': 'application/json', Cookie: otherFounderCookie },
    body: JSON.stringify({ location: 'Unauthorized change' }),
  });
  assert.equal(stolenStartup.status, 404);
  assert.equal(server.model.records[0].location, 'Mumbai, India');
});

test('founders can discover investor profiles through a safe filtered projection', async () => {
  const response = await fetch(`${baseUrl}/api/profiles/investors?industry=Health&stage=Seed&location=India`, { headers: { Cookie: founderCookie } });
  assert.equal(response.status, 200);
  const result = await response.json();
  assert.equal(result.data.length, 1);
  assert.equal(result.data[0].displayName, 'Profile Investor');
  assert.deepEqual(result.data[0].profile.industriesOfInterest, ['Health', 'Climate']);
  assert.equal('email' in result.data[0], false);
  assert.equal('phone' in result.data[0].profile, false);
  assert.equal('city' in result.data[0].profile, false);
  assert.equal('investmentRange' in result.data[0].profile, false);

  const denied = await fetch(`${baseUrl}/api/profiles/investors`, { headers: { Cookie: investorCookie } });
  assert.equal(denied.status, 403);
});

test('founders request verification and administrators review it with server-enforced access', async () => {
  const deniedQueue = await fetch(`${baseUrl}/api/admin/startups/verification`, { headers: { Cookie: founderCookie } });
  assert.equal(deniedQueue.status, 403);

  const requested = await fetch(`${baseUrl}/api/profiles/me/startup/verification`, { method: 'POST', headers: { Cookie: founderCookie } });
  assert.equal(requested.status, 202);
  assert.equal((await requested.json()).data.verificationStatus, 'pending');

  const queue = await fetch(`${baseUrl}/api/admin/startups/verification`, { headers: { Cookie: adminCookie } });
  assert.equal((await queue.json()).data[0]._id, startupId);

  const reviewed = await fetch(`${baseUrl}/api/admin/startups/${startupId}/verification`, {
    method: 'PATCH', headers: { 'Content-Type': 'application/json', Cookie: adminCookie }, body: JSON.stringify({ status: 'verified' }),
  });
  assert.equal(reviewed.status, 200);
  assert.equal((await reviewed.json()).data.verificationStatus, 'verified');
});

test('administrators can suspend and reinstate accounts without exposing private profiles', async () => {
  const denied = await fetch(`${baseUrl}/api/admin/users`, { headers: { Cookie: investorCookie } });
  assert.equal(denied.status, 403);

  const list = await fetch(`${baseUrl}/api/admin/users`, { headers: { Cookie: adminCookie } });
  const accounts = (await list.json()).data;
  assert.ok(accounts.some((account) => account.id === investor._id));
  assert.equal('email' in accounts[0], false);
  assert.equal('profile' in accounts[0], false);

  const suspended = await fetch(`${baseUrl}/api/admin/users/${investor._id}/status`, {
    method: 'PATCH', headers: { 'Content-Type': 'application/json', Cookie: adminCookie }, body: JSON.stringify({ status: 'suspended' }),
  });
  assert.equal(suspended.status, 200);
  assert.equal((await fetch(`${baseUrl}/api/profiles/me`, { headers: { Cookie: investorCookie } })).status, 401);

  const reinstated = await fetch(`${baseUrl}/api/admin/users/${investor._id}/status`, {
    method: 'PATCH', headers: { 'Content-Type': 'application/json', Cookie: adminCookie }, body: JSON.stringify({ status: 'active' }),
  });
  assert.equal(reinstated.status, 200);
  assert.equal((await fetch(`${baseUrl}/api/profiles/me`, { headers: { Cookie: investorCookie } })).status, 200);

  const overview = await fetch(`${baseUrl}/api/admin/overview`, { headers: { Cookie: adminCookie } });
  assert.equal(overview.status, 200);
  assert.equal((await overview.json()).data.investors, 1);
});
