import { createServer } from 'node:http';
import { fileURLToPath } from 'node:url';
import nodemailer from 'nodemailer';
import { createApp } from './app.js';

const sender = process.env.SMTP_USER?.trim();
const password = process.env.SMTP_APP_PASSWORD?.replace(/\s/g, '');
const recipient = process.env.ENQUIRY_TO?.trim() || 'sunrisesolution93@gmail.com';
const configured = Boolean(sender && password);

// Each request gets its own transport, so its deadline can close only that connection.
const sendMail = configured ? async message => {
  const transport = nodemailer.createTransport({
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
  try {
    return await Promise.race([
      transport.sendMail(message),
      new Promise((_resolve, reject) => {
        timer = setTimeout(() => {
          transport.close();
          reject(new Error('Mail deadline exceeded.'));
        }, 20000);
      }),
    ]);
  } finally {
    clearTimeout(timer);
    transport.close();
  }
} : undefined;

const app = createApp({
  sendMail,
  sender,
  recipient,
  appOrigin: process.env.APP_ORIGIN,
  staticDir: fileURLToPath(new URL('../dist/', import.meta.url)),
});
const server = createServer({ requestTimeout: 25000, headersTimeout: 10000 }, app);
const port = Number(process.env.PORT || 3001);
const host = process.env.HOST || '127.0.0.1';
server.listen(port, host, () => {
  console.log(`SunriseAI server listening on ${host}:${port}.`);
  console.log(configured ? 'Gmail sending is configured; inbox delivery still requires verification.' : 'Gmail sending is not configured. Set SMTP_USER and SMTP_APP_PASSWORD privately.');
});
server.on('error', error => {
  console.error(`Unable to start SunriseAI server (${error.code || 'startup error'}).`);
  process.exitCode = 1;
});
for (const signal of ['SIGINT', 'SIGTERM']) process.once(signal, () => {
  server.close(() => process.exit(0));
  setTimeout(() => { server.closeAllConnections(); process.exit(0); }, 5000).unref();
});
