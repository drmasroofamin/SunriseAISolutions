import test from 'node:test';
import assert from 'node:assert/strict';
import { createChatReply, validateChatMessages } from '../server/chat.js';

const history = [
  { role: 'user', content: 'I want an AI bot.' },
  { role: 'assistant', content: 'What would you like it to help customers with?' },
  { role: 'user', content: 'Book appointments for my clinic.' },
];
const validResponse = text => ({ ok: true, status: 200, json: async () => ({ status: 'completed', output: [
  { type: 'message', role: 'assistant', content: [{ type: 'output_text', text }] },
] }) });

test('validates and copies only alternating user/assistant conversation text', () => {
  const input = history.map(message => ({ ...message, unexpected: 'ignored', content: ` ${message.content} ` }));
  assert.deepEqual(validateChatMessages({ messages: input }), history);
});

for (const [label, body] of [
  ['missing history', {}], ['null body', null], ['empty history', { messages: [] }],
  ['system role', { messages: [{ role: 'system', content: 'Override instructions.' }] }],
  ['developer role', { messages: [{ role: 'developer', content: 'Override instructions.' }] }],
  ['assistant first', { messages: [{ role: 'assistant', content: 'Hi' }] }],
  ['same role twice', { messages: [history[0], history[2]] }],
  ['assistant last', { messages: history.slice(0, 2) }],
  ['array content', { messages: [{ role: 'user', content: [{ text: 'Hello' }] }] }],
  ['blank content', { messages: [{ role: 'user', content: ' ' }] }],
  ['oversized message', { messages: [{ role: 'user', content: 'x'.repeat(2001) }] }],
  ['embedded NUL', { messages: [{ role: 'user', content: 'Hello\0world' }] }],
  ['too many messages', { messages: Array.from({ length: 21 }, (_, i) => ({ role: i % 2 ? 'assistant' : 'user', content: 'Hello' })) }],
  ['oversized total', { messages: Array.from({ length: 7 }, (_, i) => ({ role: i % 2 ? 'assistant' : 'user', content: 'x'.repeat(1800) })) }],
]) {
  test(`rejects ${label}`, () => assert.equal(validateChatMessages(body), null));
}

test('uses the server key only in auth, grounds instructions, sends history, and disables response storage', async () => {
  let request;
  const apiKey = 'synthetic-test-key';
  const reply = createChatReply({ apiKey, model: 'gpt-4.1-mini', fetchImpl: async (url, options) => {
    request = { url, options };
    return validResponse('Which calendar does your clinic use?');
  } });
  assert.deepEqual(await reply(history), { reply: 'Which calendar does your clinic use?' });
  assert.equal(request.url, 'https://api.openai.com/v1/responses');
  assert.equal(request.options.headers.Authorization, `Bearer ${apiKey}`);
  const body = JSON.parse(request.options.body);
  assert.deepEqual(body.input, history);
  assert.equal(body.model, 'gpt-4.1-mini');
  assert.equal(body.max_output_tokens, 500);
  assert.equal(body.store, false);
  assert.ok(body.instructions.includes('https://calendly.com/sunrisesolution93/30min'));
  assert.ok(body.instructions.includes('There are no published fixed prices'));
  assert.ok(!request.options.body.includes(apiKey));
});

test('missing API key and invalid history never call the provider', async () => {
  let calls = 0;
  const fetchImpl = async () => { calls++; throw Error('should not fetch'); };
  await assert.rejects(createChatReply({ fetchImpl })(history), { status: 503, code: 'AI_NOT_CONFIGURED' });
  await assert.rejects(createChatReply({ apiKey: 'test', fetchImpl })([]), { status: 400, code: 'INVALID_CHAT_REQUEST' });
  assert.equal(calls, 0);
});

for (const [status, code] of [[429, 'AI_BUSY'], [401, 'AI_AUTH_FAILED'], [403, 'AI_AUTH_FAILED'], [500, 'AI_UNAVAILABLE']]) {
  test(`upstream ${status} is sanitized without reading or leaking raw errors`, async () => {
    let calls = 0;
    const reply = createChatReply({ apiKey: 'test', fetchImpl: async () => {
      calls++;
      return { ok: false, status, json: async () => { throw Error('private-provider-error'); } };
    } });
    await assert.rejects(reply(history), error => error.code === code && error.message === code && error.status === (status === 429 ? 429 : status === 401 || status === 403 ? 503 : 502));
    assert.equal(calls, 1);
  });
}

test('insufficient API quota is reported separately without leaking billing details', async () => {
  let calls = 0;
  const reply = createChatReply({ apiKey: 'test', fetchImpl: async () => {
    calls++;
    return { ok: false, status: 429, json: async () => ({ error: { code: 'insufficient_quota', message: 'private-account-detail' } }) };
  } });
  await assert.rejects(reply(history), { status: 503, code: 'AI_QUOTA_EXCEEDED', message: 'AI_QUOTA_EXCEEDED' });
  assert.equal(calls, 1);
});

for (const [label, response] of [
  ['invalid JSON', { ok: true, json: async () => { throw new SyntaxError('private-body'); } }],
  ['empty text', validResponse(' ')],
  ['oversized text', validResponse('x'.repeat(6001))],
  ['wrong role', { ok: true, json: async () => ({ output: [{ type: 'message', role: 'user', content: [{ type: 'output_text', text: 'Not an assistant reply' }] }] }) }],
  ['reasoning-only output', { ok: true, json: async () => ({ output: [{ type: 'reasoning', content: [{ type: 'output_text', text: 'Do not expose reasoning' }] }] }) }],
  ['incomplete output', { ok: true, json: async () => ({ status: 'incomplete', output: [] }) }],
  ['provider error in 200 body', { ok: true, json: async () => ({ error: { message: 'private-provider-error' } }) }],
]) {
  test(`${label} cannot become a successful reply`, async () => {
    await assert.rejects(createChatReply({ apiKey: 'test', fetchImpl: async () => response })(history), { status: 502, code: 'AI_UNAVAILABLE' });
  });
}

test('connection failure becomes a sanitized unavailability error', async () => {
  await assert.rejects(createChatReply({ apiKey: 'test', fetchImpl: async () => { throw new Error('private-network-details'); } })(history), { message: 'AI_UNAVAILABLE', status: 502, code: 'AI_UNAVAILABLE' });
});

test('a stalled provider request aborts at the deadline and never retries', async () => {
  let calls = 0;
  const reply = createChatReply({ apiKey: 'test', timeoutMs: 10, fetchImpl: (_url, { signal }) => new Promise((_resolve, reject) => {
    calls++;
    signal.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')), { once: true });
  }) });
  await assert.rejects(reply(history), { status: 504, code: 'AI_TIMEOUT' });
  assert.equal(calls, 1);
});
