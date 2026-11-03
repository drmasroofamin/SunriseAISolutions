import test from 'node:test';
import assert from 'node:assert/strict';
import { submitEnquiry, buildEmailDraft } from '../src/enquiry.js';

const recipient = 'owner@example.com';
const fields = { name: 'A & B', email: 'alex@example.com', company: 'Sun & Co', service: 'Custom AI & Knowledge', message: 'Line 1\nLine 2? 100% + ☀️' };
const reply = (success, message = '') => async () => ({ ok: true, json: async () => ({ success, message }) });

test('requires an explicit positive service response and sends the entered fields', async () => {
  let sent;
  const fetchImpl = async (url, options) => {
    sent = { url, options };
    return { ok: true, json: async () => ({ success: 'true', message: 'Form successfully submitted' }) };
  };
  assert.deepEqual(await submitEnquiry(recipient, fields, { fetchImpl }), { accepted: true });
  assert.equal(sent.url, 'https://formsubmit.co/ajax/owner%40example.com');
  assert.equal(sent.options.method, 'POST');
  const body = JSON.parse(sent.options.body);
  for (const [key, value] of Object.entries(fields)) assert.equal(body[key], value);
  assert.equal(body._replyto, fields.email);
  assert.equal(body._captcha, undefined, 'does not disable provider verification');
  assert.deepEqual(await submitEnquiry(recipient, fields, { fetchImpl: reply(true) }), { accepted: true });
});

for (const [name, fetchImpl] of [
  ['522 HTML response', async () => ({ ok: false, status: 522, json: async () => { throw Error('HTML'); } })],
  ['network failure', async () => { throw new TypeError('Failed to fetch'); }],
  ['HTML returned with a 200 status', async () => ({ ok: true, json: async () => { throw new SyntaxError('HTML response'); } })],
  ['provider rejection', reply(false)],
  ['string rejection', reply('false')],
  ['activation required', reply(true, 'Please activate your form')],
  ['email verification required', reply('true', 'Check your email to continue')],
  ['unrecognized response', async () => ({ ok: true, json: async () => ({ message: 'OK' }) })],
  ['null response', async () => ({ ok: true, json: async () => null })],
]) {
  test(`${name} is unconfirmed and is not retried automatically`, async () => {
    let attempts = 0;
    await assert.rejects(submitEnquiry(recipient, fields, { fetchImpl: (...args) => { attempts++; return fetchImpl(...args); } }));
    assert.equal(attempts, 1);
  });
}

test('a stalled request is aborted after the deadline', async () => {
  let attempts = 0;
  const fetchImpl = (_url, { signal }) => new Promise((_resolve, reject) => {
    attempts++;
    signal.addEventListener('abort', () => reject(new DOMException('Timed out', 'AbortError')), { once: true });
  });
  await assert.rejects(submitEnquiry(recipient, fields, { fetchImpl, timeoutMs: 10 }), { name: 'AbortError' });
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
