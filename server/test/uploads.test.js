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
let storage;

const pngHeader = Buffer.from([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
  0x00, 0x00, 0x00, 0x0d, 0x49, 0x48, 0x44, 0x52,
  0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01,
]);

before(async () => {
  const uploadedObjects = [];
  storage = {
    configured: true,
    bucket: 'test-startupscout-assets',
    uploadedObjects,
    async upload(value) {
      uploadedObjects.push(value);
      return { url: `https://assets.example.test/${value.key}` };
    },
    async remove({ key }) { const index = uploadedObjects.findIndex((object) => object.key === key); if (index >= 0) uploadedObjects.splice(index, 1); },
  };
  server = await startStartupTestServer(undefined, undefined, { uploadStorage: storage });
  baseUrl = server.baseUrl;
  [founder, investor, otherFounder, admin] = await Promise.all([
    server.userModel.create({ displayName: 'Upload Founder', email: 'upload-founder@example.test', role: 'founder', founderProfile: { founderDesignation: 'CEO' } }),
    server.userModel.create({ displayName: 'Upload Investor', email: 'upload-investor@example.test', role: 'investor', investorProfile: { investorType: 'angel', investmentThesis: 'Supporting early stage founders.' } }),
    server.userModel.create({ displayName: 'Another Founder', email: 'upload-other-founder@example.test', role: 'founder', founderProfile: { founderDesignation: 'Founder' } }),
    server.userModel.create({ displayName: 'Upload Admin', email: 'upload-admin@example.test', role: 'admin' }),
  ]);
  founderCookie = makeSessionCookie(founder);
  investorCookie = makeSessionCookie(investor);
  otherFounderCookie = makeSessionCookie(otherFounder);
  adminCookie = makeSessionCookie(admin);
  const startup = await server.model.create({
    name: 'Upload Startup', industry: 'Technology', description: 'A startup used for upload ownership tests.',
    location: 'Pune, India', fundingStage: 'Seed', fundingGoal: 250000, foundedYear: 2023,
    owner: founder._id, moderationStatus: 'approved', verificationStatus: 'unverified',
  });
  startupId = startup._id;
  await server.userModel.findByIdAndUpdate(founder._id, { $set: { primaryStartup: startupId } });
  await server.userModel.findByIdAndUpdate(otherFounder._id, { $set: { primaryStartup: startupId } });
});

after(async () => server.close());

function upload(cookie, purpose, body = pngHeader, contentType = 'image/png') {
  return fetch(`${baseUrl}/api/uploads/${purpose}`, {
    method: 'POST',
    headers: { 'Content-Type': contentType, ...(cookie ? { Cookie: cookie } : {}) },
    body,
  });
}

test('investor profile photos and founder startup images are stored with Mongo metadata', async () => {
  const investorPhoto = await upload(investorCookie, 'profile-photo');
  assert.equal(investorPhoto.status, 201);
  const photo = (await investorPhoto.json()).data;
  assert.equal(photo.contentType, 'image/png');
  assert.equal(photo.size, pngHeader.length);
  assert.match(photo.url, /^https:\/\/assets\.example\.test\//);
  assert.equal(server.userModel.records.find((user) => user._id === investor._id).investorProfile.profilePhotoUrl, photo.url);
  assert.equal(server.assetModel.records[0].owner, investor._id);
  assert.equal('body' in server.assetModel.records[0], false);

  for (const purpose of ['startup-logo', 'startup-cover', 'product-gallery']) {
    const response = await upload(founderCookie, purpose);
    assert.equal(response.status, 201);
  }
  const startup = server.model.records[0];
  assert.match(startup.logoUrl, /^https:\/\/assets\.example\.test\//);
  assert.match(startup.coverImageUrl, /^https:\/\/assets\.example\.test\//);
  assert.equal(startup.productImageUrls.length, 1);
  assert.equal(server.assetModel.records.filter((asset) => asset.startup === startupId).length, 3);
});

test('upload authorization is role and owner scoped', async () => {
  assert.equal((await upload(undefined, 'profile-photo')).status, 401);
  assert.equal((await upload(investorCookie, 'startup-logo')).status, 403);
  assert.equal((await upload(adminCookie, 'profile-photo')).status, 403);
  const stolen = await upload(otherFounderCookie, 'startup-logo');
  assert.equal(stolen.status, 404);
  assert.equal(storage.uploadedObjects.length, 4);
});

test('uploads reject invalid signatures, unsupported types, unknown purposes, and oversized files', async () => {
  assert.equal((await upload(investorCookie, 'profile-photo', Buffer.from('not an image'), 'image/png')).status, 400);
  assert.equal((await upload(investorCookie, 'profile-photo', pngHeader, 'image/gif')).status, 400);
  assert.equal((await upload(investorCookie, 'unknown', pngHeader)).status, 400);
  const oversized = Buffer.alloc(5 * 1024 * 1024 + 1);
  assert.equal((await upload(investorCookie, 'profile-photo', oversized)).status, 413);
});

test('uploads return a clear configuration error when S3 is unavailable', async () => {
  storage.configured = false;
  const response = await upload(investorCookie, 'profile-photo');
  assert.equal(response.status, 503);
  storage.configured = true;
});
