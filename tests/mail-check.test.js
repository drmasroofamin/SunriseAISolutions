import test from 'node:test';
import assert from 'node:assert/strict';
import { checkMail, describeMailFailure } from '../scripts/check-mail.mjs';

const fakeEnv = { SMTP_USER: 'test@example.com', SMTP_APP_PASSWORD: 'synthetic-test-value' };
const reachable = async (_url, request) => {
  assert.equal(request.body, '{}', 'probe cannot become a real enquiry');
  assert.equal(request.headers.Origin, 'http://localhost:5173');
  return { status: 400, json: async () => ({ code: 'INVALID_ENQUIRY' }) };
};

test('missing credentials are reported without attempting SMTP', async () => {
  const logs = [];
  assert.equal(await checkMail({ env: {}, fetchImpl: reachable, createTransport: () => { throw Error('should not connect'); }, log: line => logs.push(line) }), false);
  assert.ok(logs.some(line => line.includes('MAIL_NOT_CONFIGURED')));
});

test('verifies TLS/authentication and closes connection without sending any mail', async () => {
  const logs = [];
  let verified = 0, closed = 0;
  const createTransport = options => {
    assert.equal(options.secure, true);
    assert.equal(options.tls.rejectUnauthorized, true);
    assert.equal(options.port, 465);
    return { verify: async () => { verified++; }, close: () => { closed++; }, sendMail: () => { throw Error('must not send'); } };
  };
  assert.equal(await checkMail({ env: fakeEnv, createTransport, fetchImpl: reachable, log: line => logs.push(line) }), true);
  assert.equal(verified, 1);
  assert.equal(closed, 1);
  assert.ok(!logs.join('\n').includes(fakeEnv.SMTP_APP_PASSWORD));
  assert.ok(!logs.join('\n').includes(fakeEnv.SMTP_USER));
});

for (const [status, code] of [[403, 'ORIGIN_NOT_ALLOWED'], [429, 'RATE_LIMITED']]) {
  test(`${code} is diagnosed independently of valid Gmail authentication`, async () => {
    const logs = [];
    const result = await checkMail({ env: fakeEnv, createTransport: () => ({ verify: async () => {}, close() {} }), fetchImpl: async () => ({ status, json: async () => ({ code }) }), log: line => logs.push(line) });
    assert.equal(result, false);
    assert.ok(logs.some(line => line.includes(code)));
  });
}

test('SMTP error details are replaced with safe labels', () => {
  const result = describeMailFailure({ code: 'EAUTH', responseCode: 535, message: 'synthetic-secret', response: 'private-provider-detail' });
  assert.ok(result.includes('EAUTH'));
  assert.ok(result.includes('535'));
  assert.ok(!result.includes('synthetic-secret'));
  assert.ok(!result.includes('private-provider-detail'));
  assert.ok(describeMailFailure({ code: 'secret-value', responseCode: 'private-value' }).includes('SMTP_CHECK_FAILED'));
});

test('stalled SMTP check times out and closes transport without sending', async () => {
  let closed = false;
  const logs = [];
  assert.equal(await checkMail({ env: fakeEnv, fetchImpl: reachable, createTransport: () => ({ verify: () => new Promise(() => {}), close: () => { closed = true; } }), timeoutMs: 10, log: line => logs.push(line) }), false);
  assert.equal(closed, true);
  assert.ok(logs.some(line => line.includes('ETIMEDOUT')));
});
