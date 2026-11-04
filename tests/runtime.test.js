import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { createConfiguredApp } from '../server/runtime.js';

const fields = { name: 'Synthetic Visitor', email: 'visitor@example.com', company: 'Test Company', service: 'AI Voice Agents', message: 'A synthetic enquiry.', website: '' };
const noExternalCalls = {
  createTransport: () => { throw new Error('No transport should be created.'); },
  fetchImpl: async () => { throw new Error('No external API should be called.'); },
};

async function withRuntime(env, dependencies, run) {
  const server = createServer(createConfiguredApp(env, dependencies));
  await new Promise((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', resolve); });
  const base = `http://127.0.0.1:${server.address().port}`;
  const post = (endpoint, body, origin) => fetch(base + endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(origin ? { Origin: origin } : {}) },
    body: JSON.stringify(body),
  });
  try { await run({ base, post }); }
  finally { await new Promise(resolve => { server.close(resolve); server.closeAllConnections(); }); }
}

const fakeOpenAIResponse = reply => ({
  ok: true,
  json: async () => ({ status: 'completed', output: [{ type: 'message', role: 'assistant', content: [{ type: 'output_text', text: reply }] }] }),
});

test('configured runtime preserves health contracts without credentials or external calls', async () => {
  await withRuntime({}, noExternalCalls, async ({ base, post }) => {
    assert.deepEqual(await (await fetch(base + '/api/health')).json(), { ok: true, mailConfigured: false });
    assert.deepEqual(await (await fetch(base + '/api/chat/status')).json(), { configured: false });
    assert.deepEqual(await (await post('/api/enquiry', fields, 'http://localhost:5173')).json(), { code: 'MAIL_NOT_CONFIGURED' });
    const voice = await post('/api/voice/solution', { requirement: 'Answer routine enquiries', niche: 'Clinic' });
    assert.equal(voice.status, 503);
    assert.deepEqual(await voice.json(), { code: 'AI_NOT_CONFIGURED' });
  });
});

test('runtime SMTP uses fixed verified TLS settings and closes the transport after acceptance', async () => {
  let options;
  let sent;
  let created = 0;
  let closed = 0;
  const env = { SMTP_USER: ' owner@gmail.com ', SMTP_APP_PASSWORD: 'abcd efgh ijkl mnop', ENQUIRY_TO: ' destination@example.com ' };
  await withRuntime(env, {
    ...noExternalCalls,
    createTransport: value => {
      created++;
      options = value;
      return { sendMail: async message => { sent = message; return { accepted: ['destination@example.com'], rejected: [] }; }, close: () => { closed++; } };
    },
  }, async ({ base, post }) => {
    assert.deepEqual(await (await fetch(base + '/api/health')).json(), { ok: true, mailConfigured: true });
    assert.equal(created, 0, 'configuration health does not open an SMTP connection');
    const response = await post('/api/enquiry', fields);
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), { accepted: true });
    assert.deepEqual(options, {
      host: 'smtp.gmail.com', port: 465, secure: true,
      auth: { user: 'owner@gmail.com', pass: 'abcdefghijklmnop' },
      connectionTimeout: 8000, greetingTimeout: 8000, socketTimeout: 15000,
      tls: { minVersion: 'TLSv1.2', rejectUnauthorized: true },
    });
    assert.equal(sent.from.address, 'owner@gmail.com');
    assert.equal(sent.to, 'destination@example.com');
    assert.equal(sent.replyTo.address, fields.email);
    assert.equal(created, 1);
    assert.equal(closed, 1);
  });
});

test('runtime closes SMTP transport after errors and returns only the safe API code', async () => {
  let closed = 0;
  await withRuntime({ SMTP_USER: 'owner@gmail.com', SMTP_APP_PASSWORD: 'synthetic-app-password' }, {
    ...noExternalCalls,
    createTransport: () => ({ sendMail: async () => { throw Error('synthetic-private-smtp-details'); }, close: () => { closed++; } }),
  }, async ({ post }) => {
    const response = await post('/api/enquiry', fields);
    assert.equal(response.status, 502);
    assert.deepEqual(await response.json(), { code: 'MAIL_UNCONFIRMED' });
    assert.equal(closed, 1);
  });
});

test('runtime shares the configured AI key and model across chat and voice without external traffic', async () => {
  const calls = [];
  await withRuntime({ OPENAI_API_KEY: ' synthetic-key ', OPENAI_MODEL: 'synthetic-test-model' }, {
    ...noExternalCalls,
    fetchImpl: async (url, options) => {
      calls.push({ url, options, body: JSON.parse(options.body) });
      return fakeOpenAIResponse('A synthetic helpful reply.');
    },
  }, async ({ base, post }) => {
    assert.deepEqual(await (await fetch(base + '/api/chat/status')).json(), { configured: true });
    assert.equal(calls.length, 0);
    const chat = await post('/api/chat', { messages: [{ role: 'user', content: 'How does retrieval work?' }] });
    assert.equal(chat.status, 200);
    assert.deepEqual(await chat.json(), { reply: 'A synthetic helpful reply.' });
    const voice = await post('/api/voice/solution', { requirement: 'Answer routine enquiries', niche: 'Clinic' });
    assert.equal(voice.status, 200);
    assert.deepEqual(await voice.json(), { reply: 'A synthetic helpful reply.' });
    assert.equal(calls.length, 2);
    for (const call of calls) {
      assert.equal(call.url, 'https://api.openai.com/v1/responses');
      assert.equal(call.options.headers.Authorization, 'Bearer synthetic-key');
      assert.equal(call.body.model, 'synthetic-test-model');
      assert.equal(call.body.store, false);
    }
  });
});

test('Vercel runtime permits the explicit custom, deployment, and production origins only', async () => {
  const env = { APP_ORIGIN: ' https://sunrise.example/ ', VERCEL_URL: 'sunrise-preview-123.vercel.app', VERCEL_PROJECT_PRODUCTION_URL: 'sunrise.vercel.app' };
  await withRuntime(env, noExternalCalls, async ({ post }) => {
    for (const origin of ['https://sunrise.example', 'https://sunrise-preview-123.vercel.app', 'https://sunrise.vercel.app']) {
      const response = await post('/api/enquiry', fields, origin);
      assert.equal(response.status, 503, `${origin} reaches the unconfigured mail handler`);
      assert.deepEqual(await response.json(), { code: 'MAIL_NOT_CONFIGURED' });
    }
    for (const origin of ['http://localhost:5173', 'https://unrelated.vercel.app', 'https://sunrise.vercel.app.evil.example']) {
      const response = await post('/api/enquiry', fields, origin);
      assert.equal(response.status, 403);
      assert.deepEqual(await response.json(), { code: 'ORIGIN_NOT_ALLOWED' });
    }
  });
});

test('Vercel production/deployment variables establish origins when APP_ORIGIN is absent', async () => {
  for (const env of [
    { VERCEL_URL: 'sunrise-preview.vercel.app', VERCEL_PROJECT_PRODUCTION_URL: 'sunrise.vercel.app' },
    { VERCEL_URL: 'sunrise-preview.vercel.app' },
    { APP_ORIGIN: ' ', VERCEL_PROJECT_PRODUCTION_URL: 'sunrise.vercel.app' },
  ]) {
    await withRuntime(env, noExternalCalls, async ({ post }) => {
      const origin = `https://${env.VERCEL_PROJECT_PRODUCTION_URL || env.VERCEL_URL}`;
      assert.equal((await post('/api/enquiry', fields, origin)).status, 503);
      assert.equal((await post('/api/enquiry', fields, 'https://unrelated.example')).status, 403);
    });
  }
});

test('runtime rejects invalid platform hosts and APP_ORIGIN without reflecting their values', () => {
  for (const invalid of ['localhost', 'https://sunrise.vercel.app', 'sunrise.vercel.app/private', 'user:secret@sunrise.vercel.app', 'sunrise.vercel.app:443', '127.0.0.1', 'sunrise..vercel.app', '*.vercel.app', 'sunrise.vercel.app?secret=1']) {
    for (const name of ['VERCEL_URL', 'VERCEL_PROJECT_PRODUCTION_URL']) {
      assert.throws(() => createConfiguredApp({ [name]: invalid }, noExternalCalls), error => {
        assert.equal(error.message, 'Invalid Vercel hostname configuration.');
        assert.ok(!error.message.includes(invalid));
        return true;
      });
    }
  }
  for (const invalid of ['invalid-secret-value', 'https://user:private-secret@sunrise.example', 'https://sunrise.example/private', 'file:///private-secret']) {
    assert.throws(() => createConfiguredApp({ APP_ORIGIN: invalid }, noExternalCalls), { message: 'Invalid APP_ORIGIN configuration.' });
  }
});
