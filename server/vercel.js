import { createConfiguredApp } from './runtime.js';

/** Importing a function must not start a persistent server or connect to a provider. */
export function createVercelHandler(endpoint, appFactory = createConfiguredApp) {
  let app;
  return async function handler(request, response) {
    try {
      app ||= appFactory();
      // Explicit endpoint mapping also works if the hosting runtime rewrites req.url.
      request.url = endpoint;
      await app(request, response);
    } catch {
      if (response.headersSent) { response.destroy(); return; }
      response.writeHead(503, {
        'Content-Type': 'application/json; charset=utf-8',
        'Cache-Control': 'no-store',
        'X-Content-Type-Options': 'nosniff',
      });
      response.end(JSON.stringify({ code: 'SERVER_NOT_CONFIGURED' }));
    }
  };
}
