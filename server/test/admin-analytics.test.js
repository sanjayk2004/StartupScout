import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { makeSessionCookie, startStartupTestServer, validStartup } from '../test-support/startupTestServer.js';

let server;
let baseUrl;
let founder;
let investor;
let admin;
let founderCookie;
let investorCookie;
let adminCookie;
let startupId;

before(async () => {
  server = await startStartupTestServer();
  baseUrl = server.baseUrl;
  [founder, investor, admin] = await Promise.all([
    server.userModel.create({ displayName: 'Review Founder', email: 'review-founder@example.test', role: 'founder' }),
    server.userModel.create({ displayName: 'Report Investor', email: 'report-investor@example.test', role: 'investor' }),
    server.userModel.create({ displayName: 'Platform Admin', email: 'platform-admin@example.test', role: 'admin' }),
  ]);
  founderCookie = makeSessionCookie(founder);
  investorCookie = makeSessionCookie(investor);
  adminCookie = makeSessionCookie(admin);
  const created = await fetch(`${baseUrl}/api/startups`, {
    method: 'POST', headers: { 'Content-Type': 'application/json', Cookie: founderCookie }, body: JSON.stringify(validStartup),
  });
  assert.equal(created.status, 201);
  startupId = (await created.json()).data._id;
});

after(async () => server.close());

test('startup submissions stay private until an administrator approves them', async () => {
  assert.equal(server.model.records[0].moderationStatus, 'pending');
  const publicList = await fetch(`${baseUrl}/api/startups`);
  assert.deepEqual((await publicList.json()).data, []);
  const hiddenDetails = await fetch(`${baseUrl}/api/startups/${startupId}`);
  assert.equal(hiddenDetails.status, 404);
  const pendingQueue = await fetch(`${baseUrl}/api/admin/startups/pending`, { headers: { Cookie: investorCookie } });
  assert.equal(pendingQueue.status, 403);
  const queue = await fetch(`${baseUrl}/api/admin/startups/pending`, { headers: { Cookie: adminCookie } });
  assert.equal((await queue.json()).data[0]._id, startupId);

  const invalidDecision = await fetch(`${baseUrl}/api/admin/startups/${startupId}/moderation`, {
    method: 'PATCH', headers: { 'Content-Type': 'application/json', Cookie: adminCookie }, body: JSON.stringify({ status: 'pending' }),
  });
  assert.equal(invalidDecision.status, 400);
  const approved = await fetch(`${baseUrl}/api/admin/startups/${startupId}/moderation`, {
    method: 'PATCH', headers: { 'Content-Type': 'application/json', Cookie: adminCookie }, body: JSON.stringify({ status: 'approved' }),
  });
  assert.equal(approved.status, 200);
  assert.equal((await approved.json()).data.moderatedBy, admin._id);
  assert.equal((await (await fetch(`${baseUrl}/api/startups`)).json()).data.length, 1);
});

test('founder analytics use recorded profile views and actual investor requests', async () => {
  const unauthorized = await fetch(`${baseUrl}/api/analytics/founder`, { headers: { Cookie: investorCookie } });
  assert.equal(unauthorized.status, 403);
  const initial = await fetch(`${baseUrl}/api/analytics/founder`, { headers: { Cookie: founderCookie } });
  assert.deepEqual((await initial.json()).data.totals, { profileViews: 0, investorActivity: 0 });

  const founderSelfView = await fetch(`${baseUrl}/api/startups/${startupId}`, { headers: { Cookie: founderCookie } });
  assert.equal(founderSelfView.status, 200);
  const adminReviewView = await fetch(`${baseUrl}/api/startups/${startupId}`, { headers: { Cookie: adminCookie } });
  assert.equal(adminReviewView.status, 200);
  assert.equal(server.startupEventModel.records.length, 0);

  const view = await fetch(`${baseUrl}/api/startups/${startupId}`);
  assert.equal(view.status, 200);
  assert.equal(server.startupEventModel.records.length, 1);
  const requested = await fetch(`${baseUrl}/api/connections`, {
    method: 'POST', headers: { 'Content-Type': 'application/json', Cookie: investorCookie }, body: JSON.stringify({ startupId, message: 'Please share more details.' }),
  });
  assert.equal(requested.status, 201);
  const afterActivity = await fetch(`${baseUrl}/api/analytics/founder`, { headers: { Cookie: founderCookie } });
  assert.deepEqual((await afterActivity.json()).data.totals, { profileViews: 1, investorActivity: 1 });
});

test('reports validate inputs, stay private, and can only be resolved by administrators', async () => {
  const invalid = await fetch(`${baseUrl}/api/reports`, {
    method: 'POST', headers: { 'Content-Type': 'application/json', Cookie: investorCookie }, body: JSON.stringify({ startupId, reason: 'invented', details: '' }),
  });
  assert.equal(invalid.status, 400);
  const submitted = await fetch(`${baseUrl}/api/reports`, {
    method: 'POST', headers: { 'Content-Type': 'application/json', Cookie: investorCookie }, body: JSON.stringify({ startupId, reason: 'misleading', details: 'The profile has incorrect funding information.' }),
  });
  assert.equal(submitted.status, 201);
  const report = (await submitted.json()).data;
  assert.equal(report.status, 'pending');
  assert.equal(report.reporter, investor._id);

  const deniedQueue = await fetch(`${baseUrl}/api/admin/reports`, { headers: { Cookie: founderCookie } });
  assert.equal(deniedQueue.status, 403);
  const queue = await fetch(`${baseUrl}/api/admin/reports`, { headers: { Cookie: adminCookie } });
  assert.equal((await queue.json()).data.length, 1);
  const invalidDecision = await fetch(`${baseUrl}/api/admin/reports/${report._id}`, {
    method: 'PATCH', headers: { 'Content-Type': 'application/json', Cookie: adminCookie }, body: JSON.stringify({ status: 'pending' }),
  });
  assert.equal(invalidDecision.status, 400);
  const resolved = await fetch(`${baseUrl}/api/admin/reports/${report._id}`, {
    method: 'PATCH', headers: { 'Content-Type': 'application/json', Cookie: adminCookie }, body: JSON.stringify({ status: 'resolved' }),
  });
  assert.equal(resolved.status, 200);
  assert.equal((await resolved.json()).data.reviewedBy, admin._id);
});
