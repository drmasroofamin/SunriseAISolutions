import test from 'node:test';
import assert from 'node:assert/strict';
import { requestVoiceSolution } from '../src/voice.js';
const fields = { requirement: 'Answer enquiries and arrange viewings', niche: 'Real estate', name: 'Synthetic visitor', email: 'visitor@example.com' };

test('sends only business requirement and niche to the AI endpoint', async () => {
  const reply = await requestVoiceSolution(fields, { fetchImpl: async (url, options) => {
    assert.equal(url, '/api/voice/solution');
    assert.deepEqual(JSON.parse(options.body), { requirement: fields.requirement, niche: fields.niche });
    assert.equal(options.headers.Authorization, undefined);
    return { ok: true, json: async () => ({ reply: 'An AI agent could answer viewing enquiries and help request appointments.' }) };
  } });
  assert.match(reply, /viewing enquiries/);
});

test('preserves safe voice setup, quota and rate-limit errors', async () => {
  for (const code of ['AI_NOT_CONFIGURED', 'AI_QUOTA_EXCEEDED', 'AI_AUTH_FAILED', 'AI_MODEL_UNAVAILABLE', 'AI_BUSY', 'RATE_LIMITED', 'AI_TIMEOUT']) {
    await assert.rejects(requestVoiceSolution(fields, { fetchImpl: async () => ({ ok: false, json: async () => ({ code }) }) }), { code });
  }
});

test('empty replies and unknown errors are never shown as a successful recommendation', async () => {
  for (const result of [null, { reply: ' ' }, { reply: 5 }, { code: 'private-error-text' }]) {
    await assert.rejects(requestVoiceSolution(fields, { fetchImpl: async () => ({ ok: true, json: async () => result }) }), { code: 'AI_UNAVAILABLE' });
  }
});

test('closing the consultation can abort an in-flight request', async () => {
  const controller = new AbortController();
  const request = requestVoiceSolution(fields, { signal: controller.signal, fetchImpl: (_url, { signal }) => new Promise((_resolve, reject) => {
    signal.addEventListener('abort', () => reject(new DOMException('Closed', 'AbortError')), { once: true });
  }) });
  controller.abort();
  await assert.rejects(request, { name: 'AbortError' });
});

test('stalled voice requests time out without retries', async () => {
  let calls = 0;
  await assert.rejects(requestVoiceSolution(fields, { timeoutMs: 10, fetchImpl: (_url, { signal }) => new Promise((_resolve, reject) => {
    calls++;
    signal.addEventListener('abort', () => reject(new DOMException('Closed', 'AbortError')), { once: true });
  }) }), { name: 'AbortError' });
  assert.equal(calls, 1);
});
