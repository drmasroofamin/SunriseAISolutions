import { pathToFileURL } from 'node:url';
import nodemailer from 'nodemailer';

const codes = new Set(['EAUTH', 'EDNS', 'ETIMEDOUT', 'ECONNECTION', 'ECONNREFUSED', 'ECONNRESET', 'ESOCKET', 'ETLS', 'ENOAUTH']);

// Do not print raw SMTP errors: providers can include account and request details.
export function describeMailFailure(error) {
  const code = codes.has(error?.code) ? error.code : 'SMTP_CHECK_FAILED';
  const smtpStatus = Number.isInteger(error?.responseCode) && error.responseCode >= 100 && error.responseCode <= 599
    ? `; SMTP status ${error.responseCode}` : '';
  let guidance = 'Check Gmail account restrictions and the server connection.';
  if (code === 'EAUTH' || code === 'ENOAUTH') guidance = 'Gmail authentication failed. Use an App Password from the same Google account as SMTP_USER, with 2-Step Verification enabled.';
  else if (code === 'EDNS') guidance = 'The computer could not resolve smtp.gmail.com. Check its DNS or try another network.';
  else if (['ETIMEDOUT', 'ECONNECTION', 'ECONNREFUSED', 'ECONNRESET', 'ESOCKET'].includes(code)) guidance = 'The Gmail connection failed. Check whether your network or hosting allows outbound TLS connections to smtp.gmail.com on port 465.';
  else if (code === 'ETLS') guidance = 'TLS verification failed. Check the computer clock and trusted certificates; keep TLS verification enabled.';
  return `FAIL: ${code}${smtpStatus}. ${guidance}`;
}

export async function checkMail({
  env = process.env,
  createTransport = options => nodemailer.createTransport(options),
  fetchImpl = fetch,
  site = 'http://localhost:5173',
  timeoutMs = 20000,
  log = console.log,
} = {}) {
  log('This check does not send an email or display your mail credentials.');
  let blocked = false;
  try {
    const origin = new URL(site).origin;
    // An invalid enquiry tests the API and browser Origin without reaching SMTP.
    // Run just one probe: it uses one of the backend rate-limit slots.
    const response = await fetchImpl(`${origin}/api/enquiry`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Origin: origin },
      body: '{}',
      signal: AbortSignal.timeout(3000),
    });
    const body = await response.json();
    if (response.status === 400 && body?.code === 'INVALID_ENQUIRY') {
      log('PASS: enquiry API and browser origin are reachable (invalid test enquiry rejected; no email sent).');
    } else if (response.status === 403 && body?.code === 'ORIGIN_NOT_ALLOWED') {
      blocked = true;
      log('FAIL: ORIGIN_NOT_ALLOWED. For local development, leave APP_ORIGIN blank or match the exact browser origin, then restart npm run dev.');
    } else if (response.status === 429) {
      blocked = true;
      log('FAIL: RATE_LIMITED. Wait 15 minutes before another enquiry. Restarting your local development server also clears its in-memory limit.');
    } else {
      blocked = true;
      log('FAIL: the enquiry API returned an unexpected response. Confirm npm run dev is running from the latest checkout.');
    }
  } catch {
    blocked = true;
    log('FAIL: enquiry API could not be checked. Keep npm run dev running; if using a different address, pass it after npm run mail:check --.');
  }

  const sender = env.SMTP_USER?.trim();
  const password = env.SMTP_APP_PASSWORD?.replace(/\s/g, '');
  if (!sender || !password) {
    log('FAIL: MAIL_NOT_CONFIGURED. Set SMTP_USER and SMTP_APP_PASSWORD in .env.server.local, then restart npm run dev.');
    return false;
  }
  const transport = createTransport({
    host: 'smtp.gmail.com', port: 465, secure: true,
    auth: { user: sender, pass: password },
    connectionTimeout: 8000, greetingTimeout: 8000, socketTimeout: 15000,
    tls: { minVersion: 'TLSv1.2', rejectUnauthorized: true },
  });
  let timer;
  try {
    await Promise.race([
      transport.verify(),
      new Promise((_resolve, reject) => {
        timer = setTimeout(() => reject(Object.assign(new Error('Connection check timed out.'), { code: 'ETIMEDOUT' })), timeoutMs);
      }),
    ]);
    log('PASS: Gmail connection and authentication verified. No email was sent; recipient acceptance and inbox delivery are not tested.');
    log('If the form still fails, restart npm run dev to load current settings, then share only the HTTP status and JSON code of the failed /api/enquiry request.');
    return !blocked;
  } catch (error) {
    log(describeMailFailure(error));
    return false;
  } finally {
    clearTimeout(timer);
    transport.close();
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try { process.exitCode = await checkMail({ site: process.argv[2] || 'http://localhost:5173' }) ? 0 : 1; }
  catch { console.error('FAIL: mail check could not run. Confirm Node.js 24 and npm ci are installed.'); process.exitCode = 1; }
}
