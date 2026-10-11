import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { makeSessionCookie, startStartupTestServer, validStartup } from '../test-support/startupTestServer.js';

let server;
let baseUrl;
let founderCookie;
let investorCookie;
let otherInvestorCookie;
let founder;
let investor;
let otherInvestor;
let admin;
let adminCookie;
let startupId;

before(async () => {
  server = await startStartupTestServer();
  baseUrl = server.baseUrl;
  [founder, investor, otherInvestor, admin] = await Promise.all([
    server.userModel.create({ displayName: 'Founder', email: 'founder@example.test', role: 'founder' }),
    server.userModel.create({ displayName: 'Investor', email: 'investor@example.test', role: 'investor' }),
    server.userModel.create({ displayName: 'Other Investor', email: 'other@example.test', role: 'investor' }),
    server.userModel.create({ displayName: 'Admin', email: 'admin@example.test', role: 'admin' }),
  ]);
  founderCookie = makeSessionCookie(founder);
  investorCookie = makeSessionCookie(investor);
  otherInvestorCookie = makeSessionCookie(otherInvestor);
  adminCookie = makeSessionCookie(admin);
  const created = await fetch(`${baseUrl}/api/startups`, {
    method: 'POST', headers: { 'Content-Type': 'application/json', Cookie: founderCookie }, body: JSON.stringify(validStartup),
  });
  assert.equal(created.status, 201);
  startupId = (await created.json()).data._id;
  const approved = await fetch(`${baseUrl}/api/admin/startups/${startupId}/moderation`, { method: 'PATCH', headers: { 'Content-Type': 'application/json', Cookie: adminCookie }, body: JSON.stringify({ status: 'approved' }) });
  assert.equal(approved.status, 200);
});

after(async () => server.close());

test('investors can maintain a private, duplicate-safe startup watchlist', async () => {
  const denied = await fetch(`${baseUrl}/api/watchlist/${startupId}`, { method: 'PUT', headers: { Cookie: founderCookie } });
  assert.equal(denied.status, 403);

  const add = () => fetch(`${baseUrl}/api/watchlist/${startupId}`, { method: 'PUT', headers: { Cookie: investorCookie } });
  const first = await add();
  const firstItem = (await first.json()).data;
  const second = await add();
  const secondItem = (await second.json()).data;
  assert.equal(first.status, 200);
  assert.equal(second.status, 200);
  assert.equal(firstItem._id, secondItem._id);
  assert.equal(server.watchlistModel.records.length, 1);

  const otherList = await fetch(`${baseUrl}/api/watchlist`, { headers: { Cookie: otherInvestorCookie } });
  assert.deepEqual((await otherList.json()).data, []);
  const remove = await fetch(`${baseUrl}/api/watchlist/${startupId}`, { method: 'DELETE', headers: { Cookie: investorCookie } });
  assert.equal(remove.status, 204);
  assert.equal(server.watchlistModel.records.length, 0);
});

test('connection requests notify founders and support pending to accepted or declined transitions', async () => {
  const create = (message = 'I would like to learn more about this company.') => fetch(`${baseUrl}/api/connections`, {
    method: 'POST', headers: { 'Content-Type': 'application/json', Cookie: investorCookie }, body: JSON.stringify({ startupId, message }),
  });
  const created = await create();
  const request = (await created.json()).data;
  assert.equal(created.status, 201);
  assert.equal(request.status, 'pending');
  assert.equal(server.notificationModel.records[0].type, 'connection_requested');
  assert.equal(String(server.notificationModel.records[0].recipient), founder._id);
  assert.equal((await (await create()).json()).error.message, 'A connection request for this startup already exists.');

  const founderInbox = await fetch(`${baseUrl}/api/connections`, { headers: { Cookie: founderCookie } });
  assert.equal((await founderInbox.json()).data.length, 1);
  const investorOutbox = await fetch(`${baseUrl}/api/connections`, { headers: { Cookie: investorCookie } });
  assert.equal((await investorOutbox.json()).data.length, 1);

  const otherFounder = await server.userModel.create({ displayName: 'Other Founder', email: 'other-founder@example.test', role: 'founder' });
  const wrongOwnerDecision = await fetch(`${baseUrl}/api/connections/${request._id}`, {
    method: 'PATCH', headers: { 'Content-Type': 'application/json', Cookie: makeSessionCookie(otherFounder) }, body: JSON.stringify({ status: 'accepted' }),
  });
  assert.equal(wrongOwnerDecision.status, 404);

  const accepted = await fetch(`${baseUrl}/api/connections/${request._id}`, {
    method: 'PATCH', headers: { 'Content-Type': 'application/json', Cookie: founderCookie }, body: JSON.stringify({ status: 'accepted' }),
  });
  assert.equal(accepted.status, 200);
  assert.equal((await accepted.json()).data.status, 'accepted');
  assert.equal(server.notificationModel.records[1].type, 'connection_accepted');

  const repeatedDecision = await fetch(`${baseUrl}/api/connections/${request._id}`, {
    method: 'PATCH', headers: { 'Content-Type': 'application/json', Cookie: founderCookie }, body: JSON.stringify({ status: 'declined' }),
  });
  assert.equal(repeatedDecision.status, 404);
});

test('notification reads are scoped to their recipient and marked with recorded timestamps', async () => {
  const founderNotifications = await fetch(`${baseUrl}/api/notifications`, { headers: { Cookie: founderCookie } });
  const notifications = (await founderNotifications.json()).data;
  assert.equal(notifications.length, 1);

  const stolenRead = await fetch(`${baseUrl}/api/notifications/${notifications[0]._id}/read`, {
    method: 'PATCH', headers: { Cookie: otherInvestorCookie },
  });
  assert.equal(stolenRead.status, 404);

  const marked = await fetch(`${baseUrl}/api/notifications/${notifications[0]._id}/read`, {
    method: 'PATCH', headers: { Cookie: founderCookie },
  });
  assert.equal(marked.status, 200);
  assert.ok((await marked.json()).data.readAt);

  const investorNotifications = await fetch(`${baseUrl}/api/notifications`, { headers: { Cookie: investorCookie } });
  assert.equal((await investorNotifications.json()).data[0].type, 'connection_accepted');
});

test('connections reject invalid startup ids, messages, and states', async () => {
  const invalidId = await fetch(`${baseUrl}/api/connections`, {
    method: 'POST', headers: { 'Content-Type': 'application/json', Cookie: investorCookie }, body: JSON.stringify({ startupId: 'bad' }),
  });
  assert.equal(invalidId.status, 404);

  const invalidMessage = await fetch(`${baseUrl}/api/connections`, {
    method: 'POST', headers: { 'Content-Type': 'application/json', Cookie: investorCookie }, body: JSON.stringify({ startupId, message: 'x'.repeat(1001) }),
  });
  assert.equal(invalidMessage.status, 400);

  const invalidState = await fetch(`${baseUrl}/api/connections/000000000000000000000001`, {
    method: 'PATCH', headers: { 'Content-Type': 'application/json', Cookie: founderCookie }, body: JSON.stringify({ status: 'pending' }),
  });
  assert.equal(invalidState.status, 400);
});
