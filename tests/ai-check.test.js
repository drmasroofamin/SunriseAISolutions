import test from 'node:test';
import assert from 'node:assert/strict';
import { checkAI } from '../scripts/check-ai.mjs';
const env = { OPENAI_API_KEY: 'synthetic-key-not-real' };
const success = { ok: true, status: 200, json: async () => ({ status: 'completed', output: [{ type: 'message', role: 'assistant', content: [{ type: 'output_text', text: 'READY' }] }] }) };

test('missing key and default checks never make paid requests', async () => {
  let calls = 0;
  const fetchImpl = async () => { calls++; throw Error('must not call'); };
  assert.equal(await checkAI({ env: {}, fetchImpl, log() {} }), false);
  assert.equal(await checkAI({ env, fetchImpl, log() {} }), true);
  assert.equal(calls, 0);
});

test('explicit test makes one tiny request with no visitor data or key in logs', async () => {
  const logs = [];
  let calls = 0;
  assert.equal(await checkAI({ env, testRequest: true, log: line => logs.push(line), fetchImpl: async (url, options) => {
    calls++;
    assert.equal(url, 'https://api.openai.com/v1/responses');
    const body = JSON.parse(options.body);
    assert.equal(body.max_output_tokens, 16);
    assert.equal(body.store, false);
    assert.equal(body.model, 'gpt-4.1-mini');
    assert.equal(body.input, 'Reply with exactly the word READY.');
    assert.equal(options.headers.Authorization, `Bearer ${env.OPENAI_API_KEY}`);
    return success;
  } }), true);
  assert.equal(calls, 1);
  assert.ok(!logs.join('\n').includes(env.OPENAI_API_KEY));
  assert.ok(logs.some(line => line.includes('usage may be charged')));
});

for (const [status, error, expected] of [
  [429, { code: 'insufficient_quota' }, 'AI_QUOTA_EXCEEDED'],
  [429, { type: 'insufficient_quota' }, 'AI_QUOTA_EXCEEDED'],
  [429, { code: 'billing_hard_limit_reached' }, 'AI_QUOTA_EXCEEDED'],
  [429, { code: 'rate_limit_exceeded', type: 'tokens' }, 'AI_BUSY'],
  [401, { code: 'invalid_api_key' }, 'AI_AUTH_FAILED'],
  [404, { code: 'model_not_found' }, 'AI_MODEL_UNAVAILABLE'],
  [500, { code: 'synthetic-secret', type: 'synthetic-secret' }, 'AI_UNAVAILABLE'],
]) {
  test(`HTTP ${status} ${expected} exposes only whitelisted diagnostics`, async () => {
    const logs = [];
    assert.equal(await checkAI({ env, testRequest: true, log: line => logs.push(line), fetchImpl: async () => ({ ok: false, status, json: async () => ({ error: { ...error, message: 'private-provider-details' } }) }) }), false);
    assert.ok(logs.some(line => line.includes(expected)));
    assert.ok(!logs.join('\n').includes('private-provider-details'));
    assert.ok(!logs.join('\n').includes('synthetic-secret'));
  });
}

test('unreadable rate-limit response still reports HTTP 429 safely', async () => {
  const logs = [];
  assert.equal(await checkAI({ env, testRequest: true, log: line => logs.push(line), fetchImpl: async () => ({ ok: false, status: 429, json: async () => { throw Error('private'); } }) }), false);
  assert.ok(logs.some(line => line.includes('HTTP 429') && line.includes('AI_BUSY')));
});

test('deadline aborts the diagnostic without retries', async () => {
  let calls = 0;
  const logs = [];
  assert.equal(await checkAI({ env, testRequest: true, timeoutMs: 10, log: line => logs.push(line), fetchImpl: (_url, { signal }) => new Promise((_resolve, reject) => {
    calls++;
    signal.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')), { once: true });
  }) }), false);
  assert.equal(calls, 1);
  assert.ok(logs.some(line => line.includes('AI_TIMEOUT')));
});
