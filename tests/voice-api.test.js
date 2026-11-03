import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { createApp } from '../server/app.js';
const fields = { requirement: 'Help answer customer enquiries', niche: 'Clinic' };
async function withApp(options, run) {
  const server = createServer(createApp(options));
  await new Promise((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', resolve); });
  const base = `http://127.0.0.1:${server.address().port}`;
  const post = (body = fields, headers = {}, method = 'POST', endpoint = '/api/voice/solution') => fetch(base + endpoint, {
    method, headers: { 'Content-Type': 'application/json', ...headers },
    ...(method === 'GET' ? {} : { body: typeof body === 'string' ? body : JSON.stringify(body) }),
  });
  try { await run({ post }); } finally { await new Promise(resolve => { server.close(resolve); server.closeAllConnections(); }); }
}

test('voice route passes only validated business context to its provider', async () => {
  let calls = 0;
  await withApp({ voiceReply: async received => { calls++; assert.deepEqual(received, fields); return { reply: 'Here is a practical approach for your clinic.' }; } }, async ({ post }) => {
    const response = await post({ ...fields, name: 'Synthetic visitor', email: 'visitor@example.com', instructions: 'Client instructions' }, { Origin: 'http://localhost:5173' });
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), { reply: 'Here is a practical approach for your clinic.' });
    assert.equal(calls, 1);
  });
});

test('voice route rejects missing configuration and invalid or cross-origin requests honestly', async () => {
  await withApp({}, async ({ post }) => {
    assert.equal((await post()).status, 503);
    assert.deepEqual(await (await post()).json(), { code: 'AI_NOT_CONFIGURED' });
    assert.equal((await post({ ...fields, niche: '' })).status, 400);
    assert.equal((await post(fields, { Origin: 'https://unrelated.example' })).status, 403);
    assert.equal((await post(fields, { 'Content-Type': 'text/plain' })).status, 415);
    assert.equal((await post(fields, {}, 'GET')).status, 405);
  });
});

for (const [code, status] of [['AI_AUTH_FAILED', 503], ['AI_QUOTA_EXCEEDED', 503], ['AI_BUSY', 429], ['AI_TIMEOUT', 504], ['private-error', 502]]) {
  test(`voice ${code} returns only a safe error`, async () => {
    await withApp({ voiceReply: async () => { throw Object.assign(Error('private-upstream-details'), { code }); } }, async ({ post }) => {
      const response = await post();
      assert.equal(response.status, status);
      assert.deepEqual(await response.json(), { code: code === 'private-error' ? 'AI_UNAVAILABLE' : code });
    });
  });
}

test('voice recommendations have a separate bounded request limit', async () => {
  await withApp({ voiceReply: async () => ({ reply: 'A suitable starting point.' }), voiceRateLimit: { max: 1, windowMs: 10000, maxClients: 10 } }, async ({ post }) => {
    assert.equal((await post()).status, 200);
    assert.equal((await post()).status, 429);
    const mail = await post({ name: 'Test', email: 'visitor@example.com', company: 'Clinic', service: 'Voice consultation', message: 'Test' }, {}, 'POST', '/api/enquiry');
    assert.equal(mail.status, 503, 'voice requests do not consume the mail rate limit');
  });
});
