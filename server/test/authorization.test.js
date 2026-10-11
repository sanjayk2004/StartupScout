import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { makeSessionCookie, startStartupTestServer, validStartup } from '../test-support/startupTestServer.js';

let server;
let baseUrl;
let founderCookie;
let otherFounderCookie;
let investorCookie;
let adminCookie;

before(async () => {
  server = await startStartupTestServer();
  baseUrl = server.baseUrl;
  const users = server.userModel;
  const [founder, otherFounder, investor, admin] = await Promise.all([
    users.create({ displayName: 'Founder One', email: 'founder-one@example.test', role: 'founder' }),
    users.create({ displayName: 'Founder Two', email: 'founder-two@example.test', role: 'founder' }),
    users.create({ displayName: 'Investor One', email: 'investor@example.test', role: 'investor' }),
    users.create({ displayName: 'Admin One', email: 'admin@example.test', role: 'admin' }),
  ]);
  founderCookie = makeSessionCookie(founder);
  otherFounderCookie = makeSessionCookie(otherFounder);
  investorCookie = makeSessionCookie(investor);
  adminCookie = makeSessionCookie(admin);
});

after(async () => server.close());

test('startup writes require founder access and are restricted to the owning founder', async () => {
  const investorCreate = await fetch(`${baseUrl}/api/startups`, {
    method: 'POST', headers: { 'Content-Type': 'application/json', Cookie: investorCookie }, body: JSON.stringify(validStartup),
  });
  assert.equal(investorCreate.status, 403);

  const createResponse = await fetch(`${baseUrl}/api/startups`, {
    method: 'POST', headers: { 'Content-Type': 'application/json', Cookie: founderCookie }, body: JSON.stringify(validStartup),
  });
  assert.equal(createResponse.status, 201);
  const startup = (await createResponse.json()).data;

  const otherFounderUpdate = await fetch(`${baseUrl}/api/startups/${startup._id}`, {
    method: 'PATCH', headers: { 'Content-Type': 'application/json', Cookie: otherFounderCookie }, body: JSON.stringify({ location: 'Delhi, India' }),
  });
  assert.equal(otherFounderUpdate.status, 404);
  assert.equal(server.model.records[0].location, validStartup.location);

  const ownerUpdate = await fetch(`${baseUrl}/api/startups/${startup._id}`, {
    method: 'PATCH', headers: { 'Content-Type': 'application/json', Cookie: founderCookie }, body: JSON.stringify({ location: 'Bengaluru, India' }),
  });
  assert.equal(ownerUpdate.status, 200);
  assert.equal((await ownerUpdate.json()).data.location, 'Bengaluru, India');

  const otherFounderDelete = await fetch(`${baseUrl}/api/startups/${startup._id}`, { method: 'DELETE', headers: { Cookie: otherFounderCookie } });
  assert.equal(otherFounderDelete.status, 404);
  assert.equal(server.model.records.length, 1);
});

test('administrator access is server-enforced for cross-owner startup moderation', async () => {
  const startup = server.model.records[0];
  const update = await fetch(`${baseUrl}/api/startups/${startup._id}`, {
    method: 'PATCH', headers: { 'Content-Type': 'application/json', Cookie: adminCookie }, body: JSON.stringify({ location: 'Admin reviewed' }),
  });
  assert.equal(update.status, 200);
  assert.equal((await update.json()).data.location, 'Admin reviewed');
  const deletion = await fetch(`${baseUrl}/api/startups/${startup._id}`, { method: 'DELETE', headers: { Cookie: adminCookie } });
  assert.equal(deletion.status, 204);
  assert.equal(server.model.records.length, 0);
});

test('startup creation rejects missing, expired, and tampered sessions', async () => {
  const requests = [undefined, 'startupconnect_session=invalid.token.value'];
  for (const cookie of requests) {
    const response = await fetch(`${baseUrl}/api/startups`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(cookie ? { Cookie: cookie } : {}) },
      body: JSON.stringify(validStartup),
    });
    assert.equal(response.status, 401);
  }
});
