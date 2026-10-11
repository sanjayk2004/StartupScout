import assert from 'node:assert/strict';
import test from 'node:test';
import { authApi } from '../src/api/auth.js';

const originalFetch = globalThis.fetch;

test.afterEach(() => {
  globalThis.fetch = originalFetch;
});

test('investor registration uses its role-specific endpoint and cookie credentials', async () => {
  let request;
  globalThis.fetch = async (url, options) => {
    request = { url, options };
    return new Response(JSON.stringify({ user: { role: 'investor' } }), { status: 201 });
  };

  const result = await authApi.registerInvestor({
    fullName: 'Avery Investor', email: 'avery@example.test',
    password: 'a-safe-test-password', confirmPassword: 'a-safe-test-password',
  });

  assert.equal(request.url, '/api/auth/register/investor');
  assert.equal(request.options.method, 'POST');
  assert.equal(request.options.credentials, 'include');
  assert.deepEqual(JSON.parse(request.options.body), {
    fullName: 'Avery Investor', email: 'avery@example.test',
    password: 'a-safe-test-password', confirmPassword: 'a-safe-test-password',
  });
  assert.equal(result.user.role, 'investor');
});

test('founder registration uses its separate endpoint', async () => {
  let request;
  globalThis.fetch = async (url, options) => {
    request = { url, options };
    return new Response(JSON.stringify({ user: { role: 'founder' }, startup: { name: 'Northstar' } }), { status: 201 });
  };

  const result = await authApi.registerFounder({ fullName: 'Morgan Founder', startup: { name: 'Northstar' } });

  assert.equal(request.url, '/api/auth/register/founder');
  assert.equal(request.options.credentials, 'include');
  assert.equal(result.user.role, 'founder');
  assert.equal(result.startup.name, 'Northstar');
});

test('login forwards the selected account type for server-side role verification', async () => {
  let request;
  globalThis.fetch = async (url, options) => {
    request = { url, options };
    return new Response(JSON.stringify({ user: { role: 'admin' } }), { status: 200 });
  };

  const result = await authApi.login({ email: 'admin@example.test', password: 'not-a-real-secret', role: 'admin' });

  assert.equal(request.url, '/api/auth/login');
  assert.deepEqual(JSON.parse(request.options.body), { email: 'admin@example.test', password: 'not-a-real-secret', role: 'admin' });
  assert.equal(result.user.role, 'admin');
});

test('authentication errors are returned as safe user-facing messages', async () => {
  globalThis.fetch = async () => new Response(JSON.stringify({ message: 'Invalid email or password.' }), { status: 401 });

  await assert.rejects(authApi.login({ email: 'a@example.test', password: 'bad', role: 'investor' }), {
    message: 'Invalid email or password.',
  });
});

test('nested API validation errors preserve the message and field details as strings', async () => {
  globalThis.fetch = async () => new Response(JSON.stringify({
    error: {
      message: 'Registration details are invalid.',
      fields: { confirmPassword: 'Passwords do not match.', 'investmentRange.max': 'Maximum is too low.' },
    },
  }), { status: 400 });

  await assert.rejects(authApi.registerInvestor({}), (error) => {
    assert.equal(error.message, 'Registration details are invalid.');
    assert.deepEqual(error.fields, {
      confirmPassword: 'Passwords do not match.',
      'investmentRange.max': 'Maximum is too low.',
    });
    assert.notEqual(error.message, '[object Object]');
    return true;
  });
});

test('network failures use a separate connection message', async () => {
  globalThis.fetch = async () => { throw new Error('private network detail'); };

  await assert.rejects(authApi.registerInvestor({}), {
    message: 'We could not reach StartupScout. Check your connection and try again.',
  });
});

test('logout uses POST and includes the session cookie', async () => {
  let request;
  globalThis.fetch = async (url, options) => {
    request = { url, options };
    return new Response(JSON.stringify({ message: 'Signed out.' }), { status: 200 });
  };

  await authApi.logout();

  assert.equal(request.url, '/api/auth/logout');
  assert.equal(request.options.method, 'POST');
  assert.equal(request.options.credentials, 'include');
});
