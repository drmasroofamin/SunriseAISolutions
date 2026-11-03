# SunriseAI

A responsive React 19 website with Vite, Tailwind CSS 4, Framer Motion, and Lucide icons.

## Development

Use the existing checkout at `/workspace/SunriseAISolutions`; cloud tasks are isolated, so no worktree is needed.

```sh
npm ci --cache /tmp/sunrise-npm-cache
npm run dev -- --port 5173
```

Run `npm run build` to create the production output in `dist`. `npm run preview -- --port 4173` serves the production build.

## Before launch

The `config` object at the top of `src/main.jsx` holds the contact email, Calendly embed URL, WhatsApp number (international digits), and LinkedIn URL. The form uses FormSubmit for email delivery; see the activation instructions below. Never add private API keys to frontend code.

Chat is an explicitly labeled local, rule-based demonstration. Voice calling and newsletter subscription need service integration. Booking renders the configured Calendly iframe. These external destinations may need additions to the environment's network policy.

All results, case studies, and testimonials are labeled placeholders. Pricing is discussed after a discovery call. Replace them with verified content before publishing. The founder graphic is a monogram, not a photograph. Add final canonical URL and Open Graph image once the production domain and social asset are available.

## Structure

- `src/main.jsx`: reusable UI components, content, and interactions
- `src/components/ContactForm.jsx`: accessible enquiry form and fallback links
- `src/enquiry.js`: provider submission and email draft helpers
- `tests/enquiry.test.js`: submission and fallback tests
- `src/styles.css`: design tokens, layouts, responsive rules, and reduced motion support
- `index.html`: page metadata

No backend credentials or external services are required to run the local website.

## Booking and enquiry delivery

Booking buttons and the Calendly embed use https://calendly.com/sunrisesolution93/30min. The contact form uses FormSubmit's AJAX endpoint for enquiries to sunrisesolution93@gmail.com. It stays on the page, disables duplicate submission while pending, and stops waiting after 12 seconds. A provider error, invalid response, missing activation, or timeout shows an unconfirmed-submission message without clearing fields. It never retries automatically: a timed-out request may already have reached the provider. An accepted response confirms provider acceptance, not inbox delivery.

The Gmail and email-app alternatives carry all entered fields into a draft, independently of FormSubmit. The visitor must review and send that draft. Enquiry drafts are kept only in React memory; the website does not save them to browser storage.

FormSubmit requires mailbox activation. The mailbox owner must click its activation email before delivery is enabled; check spam too. Activation and anti-spam requirements depend on the provider; no CAPTCHA-disabling option or private keys are included in frontend code. Visitor enquiry details are processed by FormSubmit. If it returns a Cloudflare 522, its origin service is unavailable; the frontend cannot repair that outage. Confirm receipt from the deployed form after activation. Use direct email or Calendly while it is unavailable.

## Validation

Run `npm test` for 12 dependency-free checks covering provider responses, activation, timeouts, and encoded email fallbacks. Run `npm run build` for production validation. Browser validation uses intercepted responses to avoid sending live messages; it cannot establish that provider activation or email delivery works.
