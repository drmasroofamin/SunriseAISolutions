import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { createApp } from '../server/app.js';
import { createVercelHandler } from '../server/vercel.js';

async function withHandler(handler, run, transform = request => request) {
  const server = createServer((request, response) => handler(transform(request), response));
  await new Promise((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', resolve); });
  const base = `http://127.0.0.1:${server.address().port}`;
  const post = (body, headers = {}) => fetch(base + '/hosting-function?ignored=1', { method: 'POST', headers: { 'Content-Type': 'application/json', ...headers }, body: JSON.stringify(body) });
  try { await run({ base, post }); } finally { await new Promise(resolve => { server.close(resolve); server.closeAllConnections(); }); }
}

test('function handler lazily creates the app once and maps the known endpoint', async () => {
  let calls = 0;
  const handler = createVercelHandler('/api/health', () => { calls++; return createApp(); });
  assert.equal(calls, 0);
  await withHandler(handler, async ({ base }) => {
    for (let i = 0; i < 2; i++) assert.deepEqual(await (await fetch(base)).json(), { ok: true, mailConfigured: false });
    assert.equal(calls, 1);
  });
});

for (const format of ['object', 'string', 'buffer']) {
  test(`handles a Vercel-preparsed ${format} body without waiting for stream data`, async () => {
    let sent;
    const fields = { name: 'Test visitor', email: 'test@example.com', company: 'Clinic', service: 'AI bot', message: 'A synthetic enquiry.' };
    const handler = createVercelHandler('/api/enquiry', () => createApp({ sender: 'owner@example.com', recipient: 'owner@example.com', sendMail: async mail => { sent = mail; return { accepted: ['owner@example.com'], rejected: [] }; } }));
    await withHandler(handler, async ({ post }) => {
      const response = await post({}, { Origin: 'http://localhost:5173' });
      assert.equal(response.status, 200);
      assert.deepEqual(await response.json(), { accepted: true });
      assert.equal(sent.replyTo.address, fields.email);
    }, request => {
      request.body = format === 'object' ? fields : format === 'string' ? JSON.stringify(fields) : Buffer.from(JSON.stringify(fields));
      return request;
    });
  });
}

test('preparsed payloads still obey body limits and syntax validation', async () => {
  for (const [body, expected] of [[{ message: 'x'.repeat(1000) }, 413], ['{', 400]]) {
    const handler = createVercelHandler('/api/enquiry', () => createApp({ maxBodyBytes: 128 }));
    await withHandler(handler, async ({ post }) => assert.equal((await post({})).status, expected), request => { request.body = body; return request; });
  }
});

test('trusted deployment origins work and browser-supplied forwarded hosts cannot grant access', async () => {
  const handler = createVercelHandler('/api/chat', () => createApp({ appOrigin: 'https://sunrise.example', additionalOrigins: ['https://sunrise-preview.vercel.app'] }));
  await withHandler(handler, async ({ post }) => {
    const handoff = { messages: [{ role: 'user', content: 'I need a WhatsApp bot' }] };
    assert.equal((await post(handoff, { Origin: 'https://sunrise-preview.vercel.app' })).status, 200);
    assert.equal((await post(handoff, { Origin: 'https://unrelated.example', 'X-Forwarded-Host': 'sunrise-preview.vercel.app' })).status, 403);
  });
});

test('configuration failures return a safe JSON error without exposing environment details', async () => {
  const handler = createVercelHandler('/api/health', () => { throw Error('synthetic-secret-key'); });
  await withHandler(handler, async ({ base }) => {
    const response = await fetch(base);
    assert.equal(response.status, 503);
    assert.deepEqual(await response.json(), { code: 'SERVER_NOT_CONFIGURED' });
  });
});

test('all five function entry points export handlers without starting a server', async () => {
  for (const file of ['health.js', 'enquiry.js', 'chat.js', 'chat/status.js', 'voice/solution.js']) {
    const imported = await import(`../api/${file}`);
    assert.equal(typeof imported.default, 'function');
  }
});
