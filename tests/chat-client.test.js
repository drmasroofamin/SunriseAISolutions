import test from 'node:test';
import assert from 'node:assert/strict';
import { buildChatHistory, requestChatReply } from '../src/chat.js';
import { validateChatMessages } from '../server/chat.js';

test('sends recent conversation text without UI metadata or greeting', () => {
  const completed = [
    { id: 1, role: 'user', content: 'I need an AI bot.' },
    { id: 2, role: 'assistant', content: 'What business should it help?' },
  ];
  const history = buildChatHistory(completed, ' A clinic. ');
  assert.deepEqual(history, [
    { role: 'user', content: 'I need an AI bot.' },
    { role: 'assistant', content: 'What business should it help?' },
    { role: 'user', content: 'A clinic.' },
  ]);
  assert.deepEqual(validateChatMessages({ messages: history }), history);
});

test('trims old pairs and long assistant replies to remain inside server limits', () => {
  const completed = Array.from({ length: 60 }, (_, i) => ({ id: i, role: i % 2 ? 'assistant' : 'user', content: 'x'.repeat(i % 2 ? 6000 : 2000) }));
  const history = buildChatHistory(completed, 'A follow-up question');
  assert.ok(history.length <= 19);
  assert.ok(history.reduce((sum, message) => sum + message.content.length, 0) <= 12000);
  assert.equal(history[0].role, 'user');
  assert.deepEqual(validateChatMessages({ messages: history }), history);
});

test('posts bounded history to the same-origin endpoint and extracts a real reply', async () => {
  const messages = buildChatHistory([], 'Build me an AI bot');
  let sent;
  const reply = await requestChatReply(messages, { fetchImpl: async (url, options) => {
    sent = { url, options };
    return { ok: true, json: async () => ({ reply: 'Which tasks should it handle?' }) };
  } });
  assert.equal(sent.url, '/api/chat');
  assert.deepEqual(JSON.parse(sent.options.body), { messages });
  assert.deepEqual(reply, { reply: 'Which tasks should it handle?', showLeadForm: false, request: '' });
  assert.equal(sent.options.headers.Authorization, undefined);
});

test('keeps bounded handoff metadata separate from generated reply text', async () => {
  const result = await requestChatReply([{ role: 'user', content: 'I need a WhatsApp bot' }], { fetchImpl: async () => ({ ok: true, json: async () => ({ reply: 'Please book a call or use the form below.', showLeadForm: true, request: 'I need a WhatsApp bot', private: 'ignored' }) }) });
  assert.deepEqual(result, { reply: 'Please book a call or use the form below.', showLeadForm: true, request: 'I need a WhatsApp bot' });
});

for (const [code, status] of [['AI_NOT_CONFIGURED', 503], ['AI_BUSY', 429], ['RATE_LIMITED', 429], ['AI_TIMEOUT', 504], ['AI_AUTH_FAILED', 503], ['AI_QUOTA_EXCEEDED', 503]]) {
  test(`keeps ${code} as a safe actionable error`, async () => {
    await assert.rejects(requestChatReply([{ role: 'user', content: 'Hello' }], { fetchImpl: async () => ({ ok: false, status, json: async () => ({ code }) }) }), { code });
  });
}

test('unrecognized and empty responses never become fake assistant replies', async () => {
  for (const body of [{ reply: '' }, { reply: ' ' }, { reply: 42 }, null, { code: 'private-provider-details' }]) {
    await assert.rejects(requestChatReply([{ role: 'user', content: 'Hello' }], { fetchImpl: async () => ({ ok: true, json: async () => body }) }), { code: 'AI_UNAVAILABLE' });
  }
});

test('aborts a stalled chat request without retrying', async () => {
  let calls = 0;
  await assert.rejects(requestChatReply([{ role: 'user', content: 'Hello' }], { timeoutMs: 10, fetchImpl: (_url, { signal }) => new Promise((_resolve, reject) => {
    calls++;
    signal.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')), { once: true });
  }) }), { name: 'AbortError' });
  assert.equal(calls, 1);
});
