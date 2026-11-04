import { createServer } from 'node:http';
import { createConfiguredApp } from './runtime.js';

let app;
try {
  app = createConfiguredApp();
} catch {
  console.error('Unable to configure SunriseAI server. Check the server environment settings.');
  process.exitCode = 1;
}

if (app) {
  const server = createServer({ requestTimeout: 25000, headersTimeout: 10000 }, app);
  const port = Number(process.env.PORT || 3001);
  const host = process.env.HOST || '127.0.0.1';
  server.listen(port, host, () => {
    console.log(`SunriseAI server listening on ${host}:${port}.`);
    console.log(process.env.OPENAI_API_KEY?.trim() ? 'AI chat key is configured; live API access requires verification.' : 'AI chat is not configured. Set OPENAI_API_KEY privately.');
    const mailConfigured = Boolean(process.env.SMTP_USER?.trim() && process.env.SMTP_APP_PASSWORD?.replace(/\s/g, ''));
    console.log(mailConfigured ? 'Gmail sending is configured; inbox delivery still requires verification.' : 'Gmail sending is not configured. Set SMTP_USER and SMTP_APP_PASSWORD privately.');
  });
  server.on('error', error => {
    console.error(`Unable to start SunriseAI server (${error.code || 'startup error'}).`);
    process.exitCode = 1;
  });
  for (const signal of ['SIGINT', 'SIGTERM']) process.once(signal, () => {
    server.close(() => process.exit(0));
    setTimeout(() => { server.closeAllConnections(); process.exit(0); }, 5000).unref();
  });
}
