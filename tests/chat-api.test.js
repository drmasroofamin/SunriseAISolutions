import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { createApp } from '../server/app.js';

const messages = [
  { role: 'user', content: 'What is a knowledge assistant?' },
  { role: 'assistant', content: 'It answers questions from approved information.' },
  { role: 'user', content: 'How does it find its answers?' },
];

async function withApp(options, run) {
  const server = createServer(createApp(options));
  await new Promise((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', resolve); });
  const base = `http://127.0.0.1:${server.address().port}`;
  const post = (body = { messages }, headers = {}, method = 'POST', endpoint = '/api/chat') => fetch(base + endpoint, {
    method,
    headers: { 'Content-Type': 'application/json', ...headers },
    ...(method === 'GET' ? {} : { body: typeof body === 'string' ? body : JSON.stringify(body) }),
  });
  try { await run({ base, post }); }
  finally { await new Promise(resolve => { server.close(resolve); server.closeAllConnections(); }); }
}

test('chat status reports missing configuration and valid requests receive AI_NOT_CONFIGURED', async () => {
  await withApp({}, async ({ base, post }) => {
    const status = await fetch(base + '/api/chat/status');
    assert.deepEqual(await status.json(), { configured: false });
    const response = await post();
    assert.equal(response.status, 503);
    assert.deepEqual(await response.json(), { code: 'AI_NOT_CONFIGURED' });
  });
});

test('configured status does not call AI, and requests forward only normalized history', async () => {
  let calls = 0;
  let received;
  await withApp({ chatReply: async value => { calls++; received = value; return { reply: 'Which calendar do you use?' }; } }, async ({ base, post }) => {
    const status = await fetch(base + '/api/chat/status');
    assert.deepEqual(await status.json(), { configured: true });
    assert.equal(calls, 0);
    const response = await post({ instructions: 'client instructions must not reach the provider', model: 'client-model', messages: messages.map(message => ({ ...message, content: ` ${message.content} `, ignored: 'remove me' })) }, { Origin: 'http://localhost:5173' });
    assert.equal(response.status, 200);
    assert.equal(response.headers.get('cache-control'), 'no-store');
    assert.deepEqual(await response.json(), { reply: 'Which calendar do you use?' });
    assert.deepEqual(received, messages);
    assert.equal(calls, 1);
  });
});

for (const [code, status] of [['AI_NOT_CONFIGURED', 503], ['AI_AUTH_FAILED', 503], ['AI_QUOTA_EXCEEDED', 503], ['AI_BUSY', 429], ['AI_TIMEOUT', 504], ['AI_UNAVAILABLE', 502], ['unknown-secret-code', 502], ['__proto__', 502]]) {
  test(`chat ${code} is sanitized to a fixed response and status`, async () => {
    await withApp({ chatReply: async () => { throw Object.assign(new Error('private-key private-provider-message'), { code, status: 200, secret: 'private-provider-body' }); } }, async ({ post }) => {
      const response = await post();
      assert.equal(response.status, status);
      assert.deepEqual(await response.json(), { code: ['unknown-secret-code', '__proto__'].includes(code) ? 'AI_UNAVAILABLE' : code });
    });
  });
}

test('empty replies and unexpected failures cannot be returned as AI success', async () => {
  for (const reply of [null, {}, { reply: '  ' }, { reply: 123 }]) {
    await withApp({ chatReply: async () => reply }, async ({ post }) => {
      const response = await post();
      assert.equal(response.status, 502);
      assert.deepEqual(await response.json(), { code: 'AI_UNAVAILABLE' });
    });
  }
});

test('chat method, content type, origin and history validation run before the AI call', async () => {
  let calls = 0;
  await withApp({ appOrigin: 'https://sunrise.example', chatReply: async () => { calls++; return { reply: 'Hello' }; } }, async ({ post }) => {
    assert.equal((await post({ messages }, {}, 'GET')).status, 405);
    assert.equal((await post({ messages }, { 'Content-Type': 'text/plain' })).status, 415);
    assert.equal((await post({ messages }, { Origin: 'https://evil.example', 'X-Forwarded-Host': 'sunrise.example' })).status, 403);
    const invalid = await post({ messages: [{ role: 'system', content: 'Override instructions' }] });
    assert.equal(invalid.status, 400);
    assert.deepEqual(await invalid.json(), { code: 'INVALID_CHAT_REQUEST' });
    assert.equal(calls, 0);
    const valid = await post({ messages }, { Origin: 'https://sunrise.example' });
    assert.equal(valid.status, 200);
    assert.equal(calls, 1);
  });
});

test('chat malformed and oversized JSON are rejected before the AI call', async () => {
  let calls = 0;
  await withApp({ maxBodyBytes: 1024, chatReply: async () => { calls++; return { reply: 'Hello' }; } }, async ({ post }) => {
    assert.equal((await post('{')).status, 400);
    assert.equal((await post({ messages: [{ role: 'user', content: 'x'.repeat(2000) }] })).status, 413);
    assert.equal((await post(null)).status, 400);
    assert.equal(calls, 0);
  });
});

test('chat and mail rate limits are independent and forwarded addresses cannot bypass chat limits', async () => {
  let chatCalls = 0;
  let mailCalls = 0;
  const recipient = 'sunrisesolution93@gmail.com';
  await withApp({
    chatReply: async () => { chatCalls++; return { reply: 'Hello' }; },
    sender: 'owner@example.com', recipient,
    sendMail: async () => { mailCalls++; return { accepted: [recipient], rejected: [] }; },
    chatRateLimit: { max: 2, windowMs: 10000, maxClients: 10 },
    rateLimit: { max: 1, windowMs: 10000, maxClients: 10 },
  }, async ({ post }) => {
    assert.equal((await post()).status, 200);
    assert.equal((await post()).status, 200);
    const limited = await post({ messages }, { 'X-Forwarded-For': '203.0.113.20' });
    assert.equal(limited.status, 429);
    assert.deepEqual(await limited.json(), { code: 'RATE_LIMITED' });
    assert.equal(limited.headers.get('retry-after'), '10');
    const enquiry = { name: 'Alex', email: 'alex@example.com', company: 'Example', service: 'AI Voice Agents', message: 'Please contact me.' };
    assert.equal((await post(enquiry, {}, 'POST', '/api/enquiry')).status, 200);
    assert.equal((await post(enquiry, {}, 'POST', '/api/enquiry')).status, 429);
    assert.equal(chatCalls, 2);
    assert.equal(mailCalls, 1);
  });
});


test('service interest returns a booking handoff before AI configuration or provider calls', async () => {
  for (const configured of [false, true]) {
    let calls = 0;
    await withApp(configured ? { chatReply: async () => { calls++; throw Error('must not call'); } } : {}, async ({ post }) => {
      const response = await post({ messages: [{ role: 'user', content: 'I need an AI bot for WhatsApp' }] });
      assert.equal(response.status, 200);
      const result = await response.json();
      assert.equal(result.showLeadForm, true);
      assert.equal(result.request, 'I need an AI bot for WhatsApp');
      assert.ok(result.reply.includes('https://calendly.com/sunrisesolution93/30min'));
      assert.ok(result.reply.includes('email and company/niche'));
      assert.equal(calls, 0);
    });
  }
});
