import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { mkdtemp, mkdir, writeFile, symlink, rm } from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { createApp } from '../server/app.js';

const sender = 'owner@gmail.com';
const recipient = 'sunrisesolution93@gmail.com';
const fields = { name: 'Alex Morgan', email: 'alex@example.com', company: 'Example & Co', service: 'AI Voice Agents', message: 'Please call me.\nA second line.', website: '' };

async function withServer(options, run) {
  const server = createServer(createApp(options));
  await new Promise((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', resolve); });
  const base = `http://127.0.0.1:${server.address().port}`;
  const post = (body = fields, headers = {}, method = 'POST') => fetch(base + '/api/enquiry', {
    method, headers: { 'Content-Type': 'application/json', ...headers },
    ...(method === 'GET' ? {} : { body: typeof body === 'string' ? body : JSON.stringify(body) }),
  });
  try { await run({ base, post }); }
  finally { await new Promise(resolve => { server.close(resolve); server.closeAllConnections(); }); }
}

const configured = sendMail => ({ sender, recipient, sendMail });

test('valid enquiry sends all fields to fixed recipient with authenticated sender and visitor reply-to', async () => {
  let sent;
  await withServer(configured(async mail => { sent = mail; return { accepted: [recipient], rejected: [] }; }), async ({ post }) => {
    const response = await post({ ...fields, to: 'attacker@example.com', from: 'attacker@example.com' });
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), { accepted: true });
    assert.equal(sent.from.address, sender);
    assert.equal(sent.to, recipient);
    assert.equal(sent.replyTo.address, fields.email);
    for (const field of ['name', 'email', 'company', 'service', 'message']) assert.ok(sent.text.includes(fields[field]));
    assert.equal(sent.html, undefined);
    assert.equal(sent.attachments, undefined);
  });
});

test('default development origin permits the Vite proxy and health reports configuration only', async () => {
  let calls = 0;
  await withServer(configured(async () => { calls++; return { accepted: [recipient], rejected: [] }; }), async ({ base, post }) => {
    const health = await fetch(base + '/api/health');
    assert.deepEqual(await health.json(), { ok: true, mailConfigured: true });
    assert.equal(calls, 0, 'health does not send a verification email');
    const response = await post(fields, { Origin: 'http://localhost:5173' });
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), { accepted: true });
    assert.equal(calls, 1);
  });
});

test('unconfigured backend returns actionable 503 without pretending to send', async () => {
  await withServer({}, async ({ base, post }) => {
    const health = await fetch(base + '/api/health');
    assert.deepEqual(await health.json(), { ok: true, mailConfigured: false });
    const response = await post();
    assert.equal(response.status, 503);
    assert.deepEqual(await response.json(), { code: 'MAIL_NOT_CONFIGURED' });
  });
});

for (const [label, sendMail] of [
  ['SMTP rejection', async () => ({ accepted: [], rejected: [recipient] })],
  ['wrong recipient acceptance', async () => ({ accepted: ['other@example.com'], rejected: [] })],
  ['partial rejection', async () => ({ accepted: [recipient], rejected: ['other@example.com'] })],
  ['missing result', async () => undefined],
  ['SMTP error', async () => { throw new Error('secret-password customer-message smtp-internal'); }],
]) {
  test(`${label} never returns acceptance or exposes SMTP details`, async () => {
    await withServer(configured(sendMail), async ({ post }) => {
      const response = await post();
      assert.equal(response.status, 502);
      assert.deepEqual(await response.json(), { code: 'MAIL_UNCONFIRMED' });
    });
  });
}

test('invalid required fields, header injection, lengths, and honeypot never reach SMTP', async () => {
  let calls = 0;
  await withServer({ ...configured(async () => { calls++; }), rateLimit: { max: 100, windowMs: 10000, maxClients: 10 } }, async ({ post }) => {
    for (const invalid of [
      {}, null, [], { ...fields, name: ' ' }, { ...fields, email: 'bad-address' },
      { ...fields, email: 'a@example.com\r\nBcc: victim@example.com' },
      { ...fields, company: 'Company\nBcc: victim@example.com' },
      { ...fields, name: 'N'.repeat(121) }, { ...fields, message: 'M'.repeat(5001) },
      { ...fields, service: 12 }, { ...fields, website: 'http://spam.test' },
    ]) {
      const response = await post(invalid);
      assert.equal(response.status, 400);
    }
    assert.equal(calls, 0);
  });
});

test('only JSON POST and approved browser origins are allowed; forwarded headers do not grant access', async () => {
  let calls = 0;
  await withServer({ ...configured(async () => { calls++; return { accepted: [recipient] }; }), appOrigin: 'https://sunrise.example' }, async ({ post }) => {
    assert.equal((await post(fields, {}, 'GET')).status, 405);
    assert.equal((await post(fields, { 'Content-Type': 'text/plain' })).status, 415);
    assert.equal((await post(fields, { Origin: 'https://evil.example', 'X-Forwarded-Host': 'sunrise.example' })).status, 403);
    const response = await post(fields, { Origin: 'https://sunrise.example' });
    assert.equal(response.status, 200);
    assert.equal(response.headers.get('access-control-allow-origin'), null);
    assert.equal(calls, 1);
  });
});

test('malformed and oversized bodies are rejected before SMTP', async () => {
  let calls = 0;
  await withServer({ ...configured(async () => { calls++; }), maxBodyBytes: 1024 }, async ({ post }) => {
    assert.equal((await post('{')).status, 400);
    assert.equal((await post({ ...fields, message: 'X'.repeat(2048) })).status, 413);
    assert.equal(calls, 0);
  });
});

test('bounded per-address limit rejects excess requests and expires without a background timer', async () => {
  let time = 1000;
  let calls = 0;
  await withServer({ ...configured(async () => { calls++; return { accepted: [recipient] }; }), now: () => time, rateLimit: { max: 2, windowMs: 10000, maxClients: 1 } }, async ({ post }) => {
    assert.equal((await post()).status, 200);
    assert.equal((await post()).status, 200);
    const blocked = await post(fields, { 'X-Forwarded-For': '203.0.113.50' });
    assert.equal(blocked.status, 429);
    assert.equal(blocked.headers.get('retry-after'), '10');
    time += 10001;
    assert.equal((await post()).status, 200);
    assert.equal(calls, 3);
  });
});

test('production serves built files, MIME types, HEAD, cache policy, and blocks secrets and symlink escapes', async () => {
  const temp = await mkdtemp(path.join(os.tmpdir(), 'sunrise-static-'));
  const dist = path.join(temp, 'dist');
  try {
    await mkdir(path.join(dist, 'assets'), { recursive: true });
    await writeFile(path.join(dist, 'index.html'), '<h1>SunriseAI</h1>');
    await writeFile(path.join(dist, 'sitemap.xml'), '<urlset><url><loc>https://sunriseaisolution.org/</loc></url></urlset>');
    await writeFile(path.join(dist, 'assets', 'app-a1b2.js'), 'console.log("loaded")');
    await writeFile(path.join(dist, '.env.local'), 'secret');
    await writeFile(path.join(temp, 'outside.txt'), 'outside-secret');
    await symlink(path.join(temp, 'outside.txt'), path.join(dist, 'escaped.txt'));
    await withServer({ staticDir: dist }, async ({ base }) => {
      const index = await fetch(base + '/');
      assert.equal(index.status, 200);
      assert.match(index.headers.get('content-type'), /text\/html/);
      assert.match(await index.text(), /SunriseAI/);
      const asset = await fetch(base + '/assets/app-a1b2.js');
      assert.match(asset.headers.get('content-type'), /javascript/);
      assert.match(asset.headers.get('cache-control'), /immutable/);
      const sitemap = await fetch(base + '/sitemap.xml');
      assert.equal(sitemap.status, 200);
      assert.match(sitemap.headers.get('content-type'), /application\/xml/);
      assert.match(await sitemap.text(), /sunriseaisolution\.org/);
      const head = await fetch(base + '/', { method: 'HEAD' });
      assert.equal(head.status, 200);
      assert.equal(await head.text(), '');
      for (const forbidden of ['/.env.local', '/%2eenv.local', '/escaped.txt', '/%2e%2e%2foutside.txt', '/server/index.js', '/api/missing']) {
        const response = await fetch(base + forbidden);
        assert.equal(response.status, 404, forbidden);
        assert.ok(!(await response.text()).includes('secret'));
      }
    });
  } finally { await rm(temp, { recursive: true, force: true }); }
});
