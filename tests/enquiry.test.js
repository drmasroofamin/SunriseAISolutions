import test from 'node:test';
import assert from 'node:assert/strict';
import { submitEnquiry, buildEmailDraft } from '../src/enquiry.js';

const recipient = 'owner@example.com';
const fields = { name: 'A & B', email: 'alex@example.com', company: 'Sun & Co', service: 'Custom AI & Knowledge', message: 'Line 1\nLine 2? 100% + ☀️', website: '' };
const reply = (body, ok = true) => async () => ({ ok, json: async () => body });

test('uses our own backend, sends only entered fields, and requires explicit acceptance', async () => {
  let sent;
  const fetchImpl = async (url, options) => {
    sent = { url, options };
    return { ok: true, json: async () => ({ accepted: true }) };
  };
  assert.deepEqual(await submitEnquiry(fields, { fetchImpl }), { accepted: true });
  assert.equal(sent.url, '/api/enquiry');
  assert.equal(sent.options.method, 'POST');
  assert.deepEqual(JSON.parse(sent.options.body), fields);
  assert.equal(JSON.parse(sent.options.body).recipient, undefined);
});

for (const [name, fetchImpl] of [
  ['server outage', async () => ({ ok: false, json: async () => { throw Error('Unavailable'); } })],
  ['network failure', async () => { throw new TypeError('Failed to fetch'); }],
  ['static hosting without an API', async () => ({ ok: true, json: async () => { throw new SyntaxError('HTML response'); } })],
  ['mail rejection', reply({ accepted: false }, false)],
  ['string acceptance', reply({ accepted: 'true' })],
  ['error status with positive body', reply({ accepted: true }, false)],
  ['unrecognized response', reply({ success: true })],
  ['null response', reply(null)],
]) {
  test(`${name} is unconfirmed and is not retried automatically`, async () => {
    let attempts = 0;
    await assert.rejects(submitEnquiry(fields, { fetchImpl: (...args) => { attempts++; return fetchImpl(...args); } }));
    assert.equal(attempts, 1);
  });
}

test('missing mail setup is identified separately for helpful on-page guidance', async () => {
  await assert.rejects(submitEnquiry(fields, { fetchImpl: reply({ code: 'MAIL_NOT_CONFIGURED' }, false) }), { code: 'MAIL_NOT_CONFIGURED' });
});

test('a stalled request is aborted after the deadline', async () => {
  let attempts = 0;
  const fetchImpl = (_url, { signal }) => new Promise((_resolve, reject) => {
    attempts++;
    signal.addEventListener('abort', () => reject(new DOMException('Timed out', 'AbortError')), { once: true });
  });
  await assert.rejects(submitEnquiry(fields, { fetchImpl, timeoutMs: 10 }), { name: 'AbortError' });
  assert.equal(attempts, 1);
});

test('email alternatives preserve and encode all fields, including punctuation and Unicode', () => {
  const draft = buildEmailDraft(recipient, fields);
  const gmail = new URL(draft.gmail);
  const mailto = new URL(draft.mailto);
  assert.equal(gmail.origin, 'https://mail.google.com');
  assert.equal(gmail.searchParams.get('to'), recipient);
  assert.equal(mailto.pathname, recipient);
  assert.equal(mailto.searchParams.get('subject'), gmail.searchParams.get('su'));
  const body = mailto.searchParams.get('body');
  assert.equal(body, gmail.searchParams.get('body'));
  assert.ok(body.startsWith(`Name: ${fields.name}\nEmail: ${fields.email}\nCompany: ${fields.company}\nService: ${fields.service}\n\n`));
  for (const value of Object.values(fields)) assert.ok(body.includes(value));
});
