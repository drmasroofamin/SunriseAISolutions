import test from 'node:test';
import assert from 'node:assert/strict';
import { createVoiceReply, validateVoiceRequest } from '../server/voice.js';

const business = { requirement: 'I need a WhatsApp bot to help with clinic enquiries.', niche: 'Healthcare clinic' };
const responseWith = (text, additions = {}) => ({ ok: true, status: 200, json: async () => ({ status: 'completed', output: [
  { type: 'message', role: 'assistant', content: [{ type: 'output_text', text }] },
], ...additions }) });

test('validates business fields and drops name, email and client instructions', () => {
  assert.deepEqual(validateVoiceRequest({
    requirement: ` ${business.requirement} `, niche: ` ${business.niche} `,
    name: 'Visitor Name', email: 'visitor@example.com', instructions: 'client-instructions', model: 'client-model',
  }), business);
});

for (const [label, body] of [
  ['null', null], ['array', []], ['empty body', {}],
  ['missing niche', { requirement: 'Help with bookings' }],
  ['blank requirement', { ...business, requirement: '  ' }],
  ['blank niche', { ...business, niche: '\n ' }],
  ['oversized requirement', { ...business, requirement: 'x'.repeat(2001) }],
  ['oversized niche', { ...business, niche: 'x'.repeat(201) }],
  ['non-text requirement', { ...business, requirement: ['help'] }],
  ['non-text niche', { ...business, niche: 42 }],
  ['NUL requirement', { ...business, requirement: 'help\0me' }],
  ['NUL niche', { ...business, niche: 'clinic\0niche' }],
]) {
  test(`rejects ${label} before making a request`, async () => {
    let calls = 0;
    assert.equal(validateVoiceRequest(body), null);
    await assert.rejects(createVoiceReply({ apiKey: 'test', fetchImpl: async () => { calls++; } })(body), { code: 'INVALID_VOICE_REQUEST', status: 400 });
    assert.equal(calls, 0);
  });
}

test('sends only business context with fixed instructions and bounded generation', async () => {
  let sent;
  const apiKey = 'synthetic-private-test-key';
  const reply = await createVoiceReply({ apiKey, model: 'gpt-4.1-mini', fetchImpl: async (url, options) => {
    sent = { url, options };
    return responseWith('A clinic bot could answer routine enquiries and route appointment requests. Book a detailed discussion with our team.');
  } })({ ...business, name: 'Contact Person', email: 'visitor@example.com', instructions: 'untrusted-client-instructions' });
  assert.ok(reply.reply.includes('clinic bot'));
  assert.equal(sent.url, 'https://api.openai.com/v1/responses');
  assert.equal(sent.options.headers.Authorization, `Bearer ${apiKey}`);
  const body = JSON.parse(sent.options.body);
  assert.deepEqual(JSON.parse(body.input[0].content), business);
  assert.equal(body.input[0].role, 'user');
  assert.equal(body.model, 'gpt-4.1-mini');
  assert.equal(body.max_output_tokens, 350);
  assert.equal(body.store, false);
  assert.ok(body.instructions.includes('60-100 words'));
  assert.ok(body.instructions.includes('free 30-minute strategy call'));
  assert.ok(body.instructions.includes('Never claim that contact details have been sent'));
  for (const privateValue of ['Contact Person', 'visitor@example.com', 'untrusted-client-instructions', apiKey]) assert.ok(!sent.options.body.includes(privateValue));
});

test('missing key blocks generation and never calls provider', async () => {
  let calls = 0;
  await assert.rejects(createVoiceReply({ fetchImpl: async () => { calls++; } })(business), { status: 503, code: 'AI_NOT_CONFIGURED' });
  assert.equal(calls, 0);
});

for (const [status, error, expected, appStatus] of [
  [401, { code: 'invalid_api_key' }, 'AI_AUTH_FAILED', 503],
  [403, {}, 'AI_AUTH_FAILED', 503],
  [404, { code: 'model_not_found' }, 'AI_MODEL_UNAVAILABLE', 503],
  [429, { type: 'insufficient_quota' }, 'AI_QUOTA_EXCEEDED', 503],
  [429, { code: 'rate_limit_exceeded' }, 'AI_BUSY', 429],
  [500, { message: 'private-provider-details' }, 'AI_UNAVAILABLE', 502],
]) {
  test(`sanitizes upstream ${status} to ${expected} without leaking provider data`, async () => {
    let calls = 0;
    await assert.rejects(createVoiceReply({ apiKey: 'test', fetchImpl: async () => {
      calls++;
      return { ok: false, status, json: async () => ({ error: { ...error, message: 'private-provider-details' } }) };
    } })(business), { status: appStatus, code: expected, message: expected });
    assert.equal(calls, 1);
  });
}

for (const [label, response] of [
  ['unreadable error', { ok: false, status: 429, json: async () => { throw Error('private-html'); } }],
  ['invalid JSON', { ok: true, json: async () => { throw Error('private-body'); } }],
  ['empty reply', responseWith(' ')],
  ['oversized reply', responseWith('x'.repeat(3501))],
  ['incomplete reply', responseWith('Partial reply', { status: 'incomplete' })],
  ['missing completion status', responseWith('Unknown status', { status: undefined })],
  ['provider error', responseWith('No', { error: { message: 'private-error' } })],
  ['wrong role', { ok: true, json: async () => ({ status: 'completed', output: [{ type: 'message', role: 'user', content: [{ type: 'output_text', text: 'Not a reply' }] }] }) }],
  ['reasoning-only output', { ok: true, json: async () => ({ status: 'completed', output: [{ type: 'reasoning', content: [{ type: 'output_text', text: 'Private reasoning' }] }] }) }],
]) {
  test(`${label} cannot produce a successful voice reply`, async () => {
    await assert.rejects(createVoiceReply({ apiKey: 'test', fetchImpl: async () => response })(business), { code: label === 'unreadable error' ? 'AI_BUSY' : 'AI_UNAVAILABLE' });
  });
}

test('network errors expose no raw details', async () => {
  await assert.rejects(createVoiceReply({ apiKey: 'test', fetchImpl: async () => { throw Error('private-network-error'); } })(business), { status: 502, code: 'AI_UNAVAILABLE', message: 'AI_UNAVAILABLE' });
});

test('aborts stalled generation at the deadline and never retries', async () => {
  let calls = 0;
  await assert.rejects(createVoiceReply({ apiKey: 'test', timeoutMs: 10, fetchImpl: (_url, { signal }) => new Promise((_resolve, reject) => {
    calls++;
    signal.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')), { once: true });
  }) })(business), { status: 504, code: 'AI_TIMEOUT' });
  assert.equal(calls, 1);
});
