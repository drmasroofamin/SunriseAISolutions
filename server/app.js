import { createReadStream } from 'node:fs';
import { realpath, stat } from 'node:fs/promises';
import path from 'node:path';

const EMAIL = /^[^\s@<>,;"\r\n]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.ico': 'image/x-icon',
  '.woff2': 'font/woff2', '.txt': 'text/plain; charset=utf-8',
};
const DEFAULT_ORIGINS = [
  'http://localhost:5173', 'http://127.0.0.1:5173',
  'http://localhost:3001', 'http://127.0.0.1:3001',
  'http://localhost:4173', 'http://127.0.0.1:4173',
];

function json(response, status, body, headers = {}) {
  response.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff',
    ...headers,
  });
  response.end(JSON.stringify(body));
}

function readJson(request, limit) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    const fail = status => {
      request.removeListener('data', data);
      request.removeListener('end', end);
      request.resume();
      reject({ status });
    };
    const data = chunk => {
      size += chunk.length;
      if (size > limit) return fail(413);
      chunks.push(chunk);
    };
    const end = () => {
      try { resolve(JSON.parse(Buffer.concat(chunks).toString('utf8'))); }
      catch { reject({ status: 400 }); }
    };
    request.on('data', data);
    request.once('end', end);
    request.once('aborted', () => reject({ status: 400 }));
    request.once('error', () => reject({ status: 400 }));
  });
}

export function validateEnquiry(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) return null;
  if (body.website !== undefined && body.website !== '') return null;
  const fields = {};
  for (const [name, max] of Object.entries({ name: 120, email: 254, company: 200, service: 120, message: 5000 })) {
    if (typeof body[name] !== 'string' || body[name].length > max || !body[name].trim()) return null;
    fields[name] = body[name].trim();
    if (fields[name].includes('\0') || (name !== 'message' && /[\r\n]/.test(fields[name]))) return null;
  }
  if (!EMAIL.test(fields.email)) return null;
  return fields;
}

/** Returns a request handler. Inject sendMail for tests; never send to a visitor-selected address. */
export function createApp({
  sendMail,
  sender,
  recipient = 'sunrisesolution93@gmail.com',
  appOrigin,
  staticDir = path.resolve('dist'),
  maxBodyBytes = 32768,
  rateLimit = { max: 5, windowMs: 15 * 60 * 1000, maxClients: 10000 },
  now = Date.now,
} = {}) {
  if (sender && !EMAIL.test(sender)) throw new Error('Invalid SMTP_USER email address.');
  if (!EMAIL.test(recipient)) throw new Error('Invalid enquiry recipient.');
  const origins = new Set(appOrigin ? [new URL(appOrigin).origin] : DEFAULT_ORIGINS);
  const clients = new Map();
  const configured = typeof sendMail === 'function' && Boolean(sender);

  function allowClient(address) {
    const time = now();
    // Expiry is checked on requests, so no background interval retains the server.
    for (const [key, entry] of clients) if (entry.until <= time) clients.delete(key);
    const entry = clients.get(address);
    if (!entry) {
      if (clients.size >= rateLimit.maxClients) return false;
      clients.set(address, { count: 1, until: time + rateLimit.windowMs });
      return true;
    }
    if (entry.count >= rateLimit.max) return false;
    entry.count++;
    return true;
  }

  async function staticFile(request, response, pathname) {
    if (!['GET', 'HEAD'].includes(request.method)) return json(response, 405, { code: 'METHOD_NOT_ALLOWED' }, { Allow: 'GET, HEAD' });
    let decoded;
    try { decoded = decodeURIComponent(pathname); }
    catch { return json(response, 400, { code: 'INVALID_PATH' }); }
    if (decoded.includes('\0') || decoded.includes('\\') || decoded.split('/').some(segment => segment.startsWith('.'))) {
      return json(response, 404, { code: 'NOT_FOUND' });
    }
    const candidate = path.resolve(staticDir, `.${decoded === '/' ? '/index.html' : decoded}`);
    try {
      const root = await realpath(staticDir);
      const file = await realpath(candidate);
      if (!file.startsWith(root + path.sep)) return json(response, 404, { code: 'NOT_FOUND' });
      const metadata = await stat(file);
      if (!metadata.isFile()) return json(response, 404, { code: 'NOT_FOUND' });
      response.writeHead(200, {
        'Content-Type': MIME[path.extname(file)] || 'application/octet-stream',
        'Content-Length': metadata.size,
        'X-Content-Type-Options': 'nosniff',
        'Cache-Control': decoded.startsWith('/assets/') ? 'public, max-age=31536000, immutable' : 'no-cache',
      });
      if (request.method === 'HEAD') return response.end();
      const stream = createReadStream(file);
      stream.on('error', () => response.destroy());
      stream.pipe(response);
    } catch {
      json(response, 404, { code: 'NOT_FOUND' });
    }
  }

  return async function app(request, response) {
    try {
      const { pathname } = new URL(request.url, 'http://localhost');
      if (pathname === '/api/health' && request.method === 'GET') {
        return json(response, 200, { ok: true, mailConfigured: configured });
      }
      if (pathname !== '/api/enquiry') {
        if (pathname.startsWith('/api/')) return json(response, 404, { code: 'NOT_FOUND' });
        return await staticFile(request, response, pathname);
      }
      if (request.method !== 'POST') return json(response, 405, { code: 'METHOD_NOT_ALLOWED' }, { Allow: 'POST' });
      // Origins are explicit. Forwarded headers do not grant permission or change client identity.
      if (request.headers.origin && !origins.has(request.headers.origin)) return json(response, 403, { code: 'ORIGIN_NOT_ALLOWED' });
      if (request.headers['content-type']?.split(';')[0].trim().toLowerCase() !== 'application/json') {
        return json(response, 415, { code: 'JSON_REQUIRED' });
      }
      if (!allowClient(request.socket.remoteAddress || 'unknown')) {
        return json(response, 429, { code: 'RATE_LIMITED' }, { 'Retry-After': String(Math.ceil(rateLimit.windowMs / 1000)) });
      }
      let body;
      try { body = await readJson(request, maxBodyBytes); }
      catch (error) { return json(response, error.status || 400, { code: 'INVALID_REQUEST' }); }
      const fields = validateEnquiry(body);
      if (!fields) return json(response, 400, { code: 'INVALID_ENQUIRY' });
      if (!configured) return json(response, 503, { code: 'MAIL_NOT_CONFIGURED' });
      try {
        const result = await sendMail({
          from: { name: 'SunriseAI Website', address: sender },
          to: recipient,
          replyTo: { name: fields.name, address: fields.email },
          subject: 'New SunriseAI website enquiry',
          text: [
            `Name: ${fields.name}`, `Email: ${fields.email}`, `Company: ${fields.company}`,
            `Service: ${fields.service}`, '', fields.message,
          ].join('\n'),
          headers: { 'X-Auto-Response-Suppress': 'All' },
        });
        const accepted = result?.accepted?.some(address => String(address).toLowerCase() === recipient.toLowerCase());
        if (!accepted || result?.rejected?.length) return json(response, 502, { code: 'MAIL_UNCONFIRMED' });
        return json(response, 200, { accepted: true });
      } catch {
        return json(response, 502, { code: 'MAIL_UNCONFIRMED' });
      }
    } catch {
      if (!response.headersSent) json(response, 500, { code: 'SERVER_ERROR' });
      else response.destroy();
    }
  };
}
