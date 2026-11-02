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

The `config` object at the top of `src/main.jsx` holds the contact email, Calendly embed URL, WhatsApp number (international digits), and LinkedIn URL. Replace the `.example` email with your verified address. The form opens the visitor's email application when configured; use a backend or form provider for direct delivery. Never add private API keys to frontend code.

Chat is an explicitly labeled local, rule-based demonstration. Voice calling and newsletter subscription need service integration. Booking renders a Calendly iframe once configured. These external destinations may need additions to the environment's network policy.

All results, pricing, case studies, and testimonials are labeled placeholders. Replace them with verified content before publishing. The founder graphic is a monogram, not a photograph. Add final canonical URL and Open Graph image once the production domain and social asset are available.

## Structure

- `src/main.jsx`: reusable UI components, content, and interactions
- `src/styles.css`: design tokens, layouts, responsive rules, and reduced motion support
- `index.html`: page metadata

No backend credentials or external services are required to run the local website.
