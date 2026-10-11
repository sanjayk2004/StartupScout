import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { makeSessionCookie, makeStartupModel, startStartupTestServer, validStartup } from '../test-support/startupTestServer.js';

let server;
let baseUrl;
let model;
let cookie;
let founder;
let adminCookie;

before(async () => {
  model = makeStartupModel();
  server = await startStartupTestServer(model);
  baseUrl = server.baseUrl;
  founder = await server.userModel.create({ displayName: 'Founder Test', email: 'founder@example.test', role: 'founder' });
  const admin = await server.userModel.create({ displayName: 'Admin Test', email: 'admin@example.test', role: 'admin' });
  cookie = makeSessionCookie(founder);
  adminCookie = makeSessionCookie(admin);
});

after(async () => server.close());

test('health route reports the API status', async () => {
  const response = await fetch(`${baseUrl}/api/health`);
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { status: 'ok' });
});

test('startup CRUD validates, creates, reads, updates, lists, and deletes records', async () => {
  const createResponse = await fetch(`${baseUrl}/api/startups`, { method: 'POST', headers: { 'Content-Type': 'application/json', Cookie: cookie }, body: JSON.stringify(validStartup) });
  assert.equal(createResponse.status, 201);
  const created = (await createResponse.json()).data;
  assert.equal(created.website, 'https://northstar.example/');
  assert.equal(String(created.owner), founder._id);

  const approval = await fetch(`${baseUrl}/api/admin/startups/${created._id}/moderation`, { method: 'PATCH', headers: { 'Content-Type': 'application/json', Cookie: adminCookie }, body: JSON.stringify({ status: 'approved' }) });
  assert.equal(approval.status, 200);

  const readResponse = await fetch(`${baseUrl}/api/startups/${created._id}`);
  assert.equal(readResponse.status, 200);
  assert.equal((await readResponse.json()).data.name, validStartup.name);

  const updateResponse = await fetch(`${baseUrl}/api/startups/${created._id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json', Cookie: cookie }, body: JSON.stringify({ location: 'Mumbai, India' }) });
  assert.equal(updateResponse.status, 200);
  assert.equal((await updateResponse.json()).data.location, 'Mumbai, India');

  const listResponse = await fetch(`${baseUrl}/api/startups?industry=Health&stage=Seed&page=1&limit=1`);
  const list = await listResponse.json();
  assert.equal(listResponse.status, 200);
  assert.equal(list.data.length, 1);
  assert.equal(list.pagination.total, 1);

  const deleteResponse = await fetch(`${baseUrl}/api/startups/${created._id}`, { method: 'DELETE', headers: { Cookie: cookie } });
  assert.equal(deleteResponse.status, 204);
  assert.equal(model.records.length, 0);
});

test('invalid data, unsafe URLs, malformed ids, and empty updates return client errors', async () => {
  const invalidCreate = await fetch(`${baseUrl}/api/startups`, { method: 'POST', headers: { 'Content-Type': 'application/json', Cookie: cookie }, body: JSON.stringify({ ...validStartup, fundingGoal: -2, website: 'javascript:alert(1)' }) });
  assert.equal(invalidCreate.status, 400);
  const invalidId = await fetch(`${baseUrl}/api/startups/nope`);
  assert.equal(invalidId.status, 400);
  const emptyUpdate = await fetch(`${baseUrl}/api/startups/000000000000000000000001`, { method: 'PATCH', headers: { 'Content-Type': 'application/json', Cookie: cookie }, body: '{}' });
  assert.equal(emptyUpdate.status, 400);
});
