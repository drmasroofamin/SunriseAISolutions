# SunriseAI

Responsive React website with Vite, Tailwind CSS, Framer Motion, and a Node.js enquiry backend. Booking uses the configured Calendly account. Enquiries are sent directly through Gmail SMTP; FormSubmit and Formspree are no longer used.

## Run on your PC

Install Node.js 24 LTS and Git. From the checkout:

```sh
npm ci
npm run dev
```

Open http://localhost:5173. The development command runs both Vite and the enquiry backend; Ctrl+C stops both. Cloud tasks should use the existing checkout at `/workspace/SunriseAISolutions`. Tasks are isolated; do not create a worktree unless explicitly requested.

## If the browser is blank

Keep the development server terminal open. Stop it with Ctrl+C, then start from the updated checkout with `npm run dev -- --force` to rebuild Vite's dependency cache. Open the exact Local URL printed by Vite and use Ctrl+Shift+R in the browser. If startup reports missing dependencies, run `npm ci` before starting again. Do not delete or share `.env.server.local`.

The website now keeps the main page available if the optional voice-panel download fails, and shows reload/booking recovery options for render errors or an initial script download failure. A failed voice download needs a page reload before retrying. These recovery screens do not repair a stopped server or blocked network request. For diagnosis, check the browser's **Console** tab (the Issues panel is different) and the `npm run dev` terminal output. Share only the error text, never configuration files or keys.

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

## Enable the Sunrise AI assistant

1. Create an API key at https://platform.openai.com/api-keys. Your OpenAI Platform project must have API billing/credits and access to the selected model. A ChatGPT subscription does not include API usage.
2. Open the existing private `.env.server.local` file. Preserve the Gmail settings and add:

   ```text
   OPENAI_API_KEY=replace_with_your_real_api_key
   OPENAI_MODEL=gpt-4.1-mini
   ```

3. Restart `npm run dev`, open the assistant, and try “I want to build an AI bot”. Follow up with your industry and a task so you can verify it remembers the conversation.

Never put the key in React, a `VITE_` variable, a Git commit, or chat. `.env.server.local` stays ignored. For a deployed website, set these variables privately on the Node.js host and restart it. The server needs HTTPS access to `api.openai.com`.

Both chat widgets share the same conversation in memory, with recent turns sent for context; reset clears the local conversation. Responses come from OpenAI, not scripted replies. The request uses the Responses API, `store: false`, at most 500 output tokens, a 25-second backend timeout, and no automatic retries. Chat requests have a separate in-memory rate limit (20 requests per connection IP per 15 minutes) so they do not consume the mail limit. As with mail, clients behind one reverse proxy share a bucket; use your host's abuse controls for a larger public deployment. API usage is charged to your OpenAI project.

The assistant uses server-owned SunriseAI information and directs interested visitors immediately to Calendly or a separate contact form. It cannot itself book appointments or send messages; the separate form sends an enquiry only after the visitor submits it. Replies can still be inaccurate. The widgets disclose OpenAI processing and advise visitors to avoid sensitive data; the website does not persist transcripts or log their contents. OpenAI's own data handling policies still apply.

`GET /api/chat/status` reports only whether a key is configured, not whether it is valid or the project has credits. Missing configuration, invalid credentials, quota limits, slow requests, and connection failures show honest unavailable/retry states while keeping the visitor's message. If setup fails, inspect the `/api/chat` response in the browser's Network panel: `AI_AUTH_FAILED` indicates rejected credentials/access; `AI_QUOTA_EXCEEDED` indicates insufficient API quota; `AI_BUSY` or `RATE_LIMITED` indicate a temporary limit. Share only that code, never the key. Live AI replies require your own private key and must be checked after configuration.

## Website voice consultation

The **Talk to our AI voice agent** button opens a guided website conversation. It welcomes the visitor, asks what they need, then collects their name, contact email and company/niche one step at a time. Answers can be spoken with push-to-talk or typed. Recognized speech is shown for review; the email address must be checked on screen. After reviewing the details, the visitor requests a short AI explanation of practical ways the solution could help their business, followed by an invitation to a detailed discovery call.

This uses the existing `OPENAI_API_KEY` and `OPENAI_MODEL`; no new provider account is needed. A recommendation uses a separate `/api/voice/solution` route and at most 350 output tokens. It is independent of the text assistant's instant booking handoff. The visitor's **requirement and niche** are the only structured fields sent to OpenAI. Do not enter sensitive information in those fields. Dedicated name/email fields remain in browser memory until the visitor explicitly submits a follow-up enquiry using the existing Gmail backend.

Speech input uses the browser's SpeechRecognition/WebKit implementation, and replies use browser speech synthesis. Browser speech providers may process audio, so the modal discloses that before listening. This is not an OpenAI audio/realtime endpoint, phone number, or inbound/outbound calling integration. Chrome/Edge on localhost or a deployed HTTPS origin are recommended; browser/OS support, microphone permission, voice availability, and speech-service connectivity vary. A typed flow and visible text remain available when speech is unsupported or denied. Closing the modal stops speech/listening and aborts its requests. No raw audio is stored by this website.

The visitor can choose a time through the Calendly button. No appointment is booked automatically. Contact details are emailed only after clicking **Send my details to SunriseAI**, with confirmation only after SMTP acceptance. Actual inbox receipt must be checked separately. Voice recommendation requests have their own limit of five per connection IP per 15 minutes. API quota/authentication/network failures show honest retry states and preserve the reviewed details.

Automated checks use fake speech, AI, and mail services. Real microphone recognition and audible playback must be checked on the target PC/browser; live recommendations and email require the existing private account settings.

## Booking-first assistant and lead capture

Clear service requests such as “I need an AI bot for WhatsApp” immediately show the Calendly booking link and a short follow-up form. The visitor can choose any available meeting time or provide their contact email and company/niche (name is optional). The form explains the intended team contact before the visitor clicks **Send contact details**. The initial requirement is included with the enquiry sent through the existing Gmail backend.

These intent matches run locally and are enforced on the backend too; no OpenAI call or AI credit is used for the handoff. General informational questions still use OpenAI. The handoff replaces the chat composer with booking/contact options to avoid a long qualification conversation. **Start a new conversation** returns to normal chat. The embedded and floating widgets share both the conversation and form fields, and only one lead submission can run at a time.

Simply typing into chat or filling the contact fields does not send email. A successful SMTP acceptance displays confirmation; a failure preserves the fields and offers booking/email alternatives. Contact-form fields are sent to the SunriseAI team, not to OpenAI. General chat is still processed by OpenAI as disclosed. Confirm actual Gmail receipt when testing the updated site; automated tests use fake mail delivery.

## Diagnose an AI request limit

`npm run ai:check` checks local key presence without calling OpenAI. For a useful diagnosis of a failed AI request, run:

```sh
npm run ai:check -- --test
```

The explicit `--test` makes one small generation request, with a maximum of 16 output tokens. It can use API credits. It sends only a fixed test prompt and prints safe HTTP/error codes, not the key, visitor messages, organization details, or raw provider errors. There are no automatic retries.

`AI_QUOTA_EXCEEDED` means to check API credits/billing and the limits for the key's OpenAI project. `AI_BUSY` reports a request/token limit and does not establish a general service outage. `AI_AUTH_FAILED` indicates rejected access; `AI_MODEL_UNAVAILABLE` indicates model access or configuration needs attention. Check https://platform.openai.com/settings/organization/billing/overview and the project's Limits page. ChatGPT subscriptions and API billing are separate. After correcting settings, restart `npm run dev` to reload the key/model before testing the assistant again.

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

Results, case studies, and testimonials are marked placeholders. Replace them with verified content before launch. Pricing is discussed after discovery. The founder image is a monogram. Chat connects to OpenAI when a server-side API key is configured; the website voice consultation uses browser speech and OpenAI; newsletter delivery remains unconnected. Add a production canonical URL and social image when available.

## Validation

```sh
npm test
npm run build
```

Tests exercise the frontend submission helpers and real HTTP APIs using injected fake mail and AI providers. They cover accepted and failed mail, missing configuration, invalid and oversized input, fixed sender/recipient rules, origin checks, rate limits, and email fallbacks without sending any real messages. Browser smoke checks also use simulated responses. Live Gmail authentication and inbox delivery require your private App Password and a real test after configuration.

## Typography and appearance

`src/theme.css` owns the shared slate/navy palette and readability updates. The page background is `#18253d`, with lighter blue cards, warm sunrise accents, Manrope Variable headings and Inter Variable body text. Both fonts are self-hosted as Latin variable WOFF2 assets (about 73KB combined), with `font-display: swap` and system fallbacks; no Google Fonts connection is required. Their license files are included under `public/fonts/`.

After updating this version, run `npm ci` to install the font packages before starting the app. The theme also covers chat, voice, contact and recovery panels. The voice overrides deliberately use higher specificity because that panel's original CSS loads in a separate lazy chunk. Responsive layouts wrap controls and stack compact form rows instead of shrinking readable input text.

## Structure

- `src/components/Chat.jsx` and `ChatContext.jsx`: shared AI conversation and accessible widgets
- `server/chat.js`: grounded OpenAI integration, validation, and error handling
- `src/components/ContactForm.jsx`: enquiry fields, status, and email alternatives
- `src/enquiry.js`: same-origin API submission and encoded email drafts
- `server/`: validated enquiry API, SMTP configuration, and production static server
- `scripts/dev.mjs`: starts both development processes
- `src/main.jsx` and `src/styles.css`: site content, components, and responsive styling
- `tests/`: frontend helper and backend tests
