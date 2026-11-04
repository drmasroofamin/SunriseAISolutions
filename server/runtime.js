import { fileURLToPath } from 'node:url';
import nodemailer from 'nodemailer';
import { createApp } from './app.js';
import { createChatReply } from './chat.js';
import { createVoiceReply } from './voice.js';

function platformOrigin(value) {
  if (value === undefined || value === '') return undefined;
  // Vercel provides hostnames, never URLs. Do not accept paths, ports or user info.
  if (typeof value !== 'string') throw new Error('Invalid Vercel hostname configuration.');
  const host = value.trim().toLowerCase();
  const labels = host.split('.');
  if (host.length > 253 || labels.length < 2 || !/[a-z]/.test(labels.at(-1)) ||
      labels.some(label => !/^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(label))) {
    throw new Error('Invalid Vercel hostname configuration.');
  }
  return `https://${host}`;
}

function explicitOrigin(value) {
  if (typeof value !== 'string' || !value.trim()) return undefined;
  try {
    const url = new URL(value.trim());
    if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password ||
        url.pathname !== '/' || url.search || url.hash || url.origin === 'null') throw new Error();
    return url.origin;
  } catch {
    // Configuration errors must not include the supplied value or URL parser details.
    throw new Error('Invalid APP_ORIGIN configuration.');
  }
}

/** Configure handlers without opening a listener; safe for standalone and serverless entry points. */
export function createConfiguredApp(env = process.env, {
  createTransport = nodemailer.createTransport,
  fetchImpl = fetch,
} = {}) {
  const sender = typeof env.SMTP_USER === 'string' ? env.SMTP_USER.trim() : undefined;
  const password = typeof env.SMTP_APP_PASSWORD === 'string' ? env.SMTP_APP_PASSWORD.replace(/\s/g, '') : '';
  const recipient = typeof env.ENQUIRY_TO === 'string' && env.ENQUIRY_TO.trim() ? env.ENQUIRY_TO.trim() : 'sunrisesolution93@gmail.com';
  const key = typeof env.OPENAI_API_KEY === 'string' ? env.OPENAI_API_KEY.trim() : '';
  const deploymentOrigin = platformOrigin(env.VERCEL_URL);
  const productionOrigin = platformOrigin(env.VERCEL_PROJECT_PRODUCTION_URL);
  const appOrigin = explicitOrigin(env.APP_ORIGIN) || productionOrigin || deploymentOrigin;
  const additionalOrigins = [...new Set([deploymentOrigin, productionOrigin].filter(Boolean))];

  // A transport belongs to one enquiry, so its deadline closes only that connection.
  const sendMail = sender && password ? async message => {
    const transport = createTransport({
      host: 'smtp.gmail.com',
      port: 465,
      secure: true,
      auth: { user: sender, pass: password },
      connectionTimeout: 8000,
      greetingTimeout: 8000,
      socketTimeout: 15000,
      tls: { minVersion: 'TLSv1.2', rejectUnauthorized: true },
    });
    let timer;
    let closed = false;
    const close = () => {
      if (closed) return;
      closed = true;
      try { transport.close(); } catch { /* Cleanup must not expose transport details. */ }
    };
    try {
      return await Promise.race([
        transport.sendMail(message),
        new Promise((_resolve, reject) => {
          timer = setTimeout(() => {
            close();
            reject(new Error('Mail deadline exceeded.'));
          }, 20000);
        }),
      ]);
    } finally {
      clearTimeout(timer);
      close();
    }
  } : undefined;

  return createApp({
    sendMail,
    chatReply: key ? createChatReply({ apiKey: key, model: env.OPENAI_MODEL || 'gpt-4.1-mini', fetchImpl }) : undefined,
    voiceReply: key ? createVoiceReply({ apiKey: key, model: env.OPENAI_MODEL || 'gpt-4.1-mini', fetchImpl }) : undefined,
    sender,
    recipient,
    appOrigin,
    additionalOrigins,
    staticDir: fileURLToPath(new URL('../dist/', import.meta.url)),
  });
}
