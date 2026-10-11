import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { makeSessionCookie, startStartupTestServer, validStartup } from '../test-support/startupTestServer.js';

let server;
let baseUrl;

before(async () => {
  server = await startStartupTestServer();
  baseUrl = server.baseUrl;
  const founder = await server.userModel.create({ displayName: 'Founder Test', email: 'founder@example.test', role: 'founder' });
  const admin = await server.userModel.create({ displayName: 'Admin Test', email: 'admin@example.test', role: 'admin' });
  const cookie = makeSessionCookie(founder);
  const created = await fetch(`${baseUrl}/api/startups`, { method: 'POST', headers: { 'Content-Type': 'application/json', Cookie: cookie }, body: JSON.stringify(validStartup) });
  assert.equal(created.status, 201);
  const { data: startup } = await created.json();
  const approval = await fetch(`${baseUrl}/api/admin/startups/${startup._id}/moderation`, { method: 'PATCH', headers: { 'Content-Type': 'application/json', Cookie: makeSessionCookie(admin) }, body: JSON.stringify({ status: 'approved' }) });
  assert.equal(approval.status, 200);
});

after(async () => server.close());

test('search and pagination constraints are applied to discovery queries', async () => {
  const response = await fetch(`${baseUrl}/api/startups?q=Northstar&page=-3&limit=1000`);
  const result = await response.json();
  assert.equal(response.status, 200);
  assert.equal(result.data.length, 1);
  assert.equal(result.pagination.page, 1);
  assert.equal(result.pagination.limit, 100);
});
