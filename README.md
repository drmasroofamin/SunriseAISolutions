# SunriseAI

Responsive React website with Vite, Tailwind CSS, Framer Motion, and a Node.js enquiry backend. Booking uses the configured Calendly account. Enquiries are sent directly through Gmail SMTP; FormSubmit and Formspree are no longer used.

## Run on your PC

Install Node.js 24 LTS and Git. From the checkout:

```sh
npm ci
npm run dev
```

Open http://localhost:5173. The development command runs both Vite and the enquiry backend; Ctrl+C stops both. Cloud tasks should use the existing checkout at `/workspace/SunriseAISolutions`. Tasks are isolated; do not create a worktree unless explicitly requested.

## Enable Gmail enquiry delivery

1. Sign in to **sunrisesolution93@gmail.com** and enable **2-Step Verification** in Google Account → Security.
2. Visit https://myaccount.google.com/apppasswords and create an App Password called `SunriseAI website`. If Google does not offer App Passwords, check the account's security settings or administrator restrictions; your ordinary Gmail password will not work here.
3. Create your private server settings file (do not overwrite an existing configuration):

   ```sh
   cp -n .env.example .env.server.local
   chmod 600 .env.server.local
   nano .env.server.local
   ```

4. Set `SMTP_USER=sunrisesolution93@gmail.com` and place the App Password after `SMTP_APP_PASSWORD=`. Keep `APP_ORIGIN` blank for local development. Save with Ctrl+O, Enter, then exit with Ctrl+X.
5. Restart `npm run dev`. Submit an enquiry, then confirm it reaches the Gmail inbox or Spam folder. The website only reports acceptance after the mail server accepts the fixed recipient; this does not guarantee inbox placement.

**Keep the App Password private.** Never paste it into chat, React code, or a GitHub commit. `.env.server.local` is ignored by Git and is loaded only by Node. No frontend variable should contain credentials; do not use `VITE_` for mail credentials.

No FormSubmit activation, Formspree account, or form-provider endpoint is required. If the password is missing, the API returns a configuration error and the form preserves all input with email and Calendly alternatives. Incorrect credentials, a blocked SMTP connection, or a temporary Gmail failure also preserve the enquiry. Requests are not automatically retried because an interrupted request may already have reached Gmail.

## Diagnose mail failures without sending an email

Keep `npm run dev` running and open a second terminal in this project:

```sh
npm run mail:check
```

This sends one intentionally invalid enquiry to check the API and browser origin, then verifies Gmail's DNS/TLS connection and authentication without sending mail. It prints only safe diagnostic labels; no password or raw SMTP response is logged. The probe consumes one rate-limit slot. For a different site address, use `npm run mail:check -- http://127.0.0.1:5173` (use the exact origin you open in the browser).

`EAUTH` means Gmail refused authentication; check the App Password belongs to `SMTP_USER`. `EDNS` indicates DNS resolution failure. Connection/time-out codes indicate a network or SMTP connection problem. `ORIGIN_NOT_ALLOWED` and `RATE_LIMITED` indicate the API refused the request before SMTP. Successful verification does not test recipient acceptance or inbox delivery. Restart development after changing `.env.server.local`; a running server keeps its previously loaded settings.

## Build and host

```sh
npm run build
npm start
```

Open http://localhost:3001. This serves both the production website and `/api/enquiry`. `npm run preview` runs the same production server. The server needs access to `smtp.gmail.com` over TLS on TCP port 465. It keeps TLS verification enabled.

For a public deployment, use a host that runs a persistent Node.js process and permits outbound SMTP. Set these **server-side** environment variables in the host's private settings:

- `SMTP_USER`: the configured Gmail account
- `SMTP_APP_PASSWORD`: its App Password
- `APP_ORIGIN`: the exact public origin, such as `https://your-domain.com`, without a path
- `HOST=0.0.0.0` and the platform's required `PORT`

Run the build during deployment and use `npm start` as the start command. Serve HTTPS through the hosting platform. Uploading only `dist/` to static hosting will not provide the enquiry API. A PC development server must remain running to process local enquiries; Gmail settings on your PC do not configure the deployed host.

The default API development port is 3001. To change it, use `API_PORT=3002 npm run dev`; Vite will proxy `/api` to that port. If you change Vite's frontend port, configure `APP_ORIGIN` to match it. The backend rate limit is in memory and applies per connection IP, not untrusted forwarded headers; behind a reverse proxy, shared traffic can share a rate-limit bucket. Use platform abuse controls before scaling across instances.

## Contact and content

The `config` object in `src/main.jsx` holds the public email, Calendly URL, WhatsApp number, and LinkedIn URL. SMTP settings belong only in the server environment.

The email-draft alternatives copy all entered fields to Gmail or the visitor's email app; the visitor must review and send that draft. Drafts are held in memory and are not persisted to browser storage. The website does not log enquiry contents or mail credentials.

Results, case studies, and testimonials are marked placeholders. Replace them with verified content before launch. Pricing is discussed after discovery. The founder image is a monogram. Chat is a local, rule-based demonstration; voice and newsletter services remain unconnected. Add a production canonical URL and social image when available.

## Validation

```sh
npm test
npm run build
```

Tests exercise the frontend submission helper and the real HTTP API using an injected fake mail transport. They cover accepted and failed mail, missing configuration, invalid and oversized input, fixed sender/recipient rules, origin checks, rate limits, and email fallbacks without sending any real messages. Browser smoke checks also use simulated responses. Live Gmail authentication and inbox delivery require your private App Password and a real test after configuration.

## Structure

- `src/components/ContactForm.jsx`: enquiry fields, status, and email alternatives
- `src/enquiry.js`: same-origin API submission and encoded email drafts
- `server/`: validated enquiry API, SMTP configuration, and production static server
- `scripts/dev.mjs`: starts both development processes
- `src/main.jsx` and `src/styles.css`: site content, components, and responsive styling
- `tests/`: frontend helper and backend tests
