# Lumia Order — Landing Page

Marketing site for **Lumia Order**, the AI ordering employee that takes restaurant orders on WhatsApp.
Implemented from the Claude Design file `Lumia Order Landing v4`.

## Stack

- [Vite](https://vite.dev) + React 19 + TypeScript
- Plain CSS with design tokens (`src/styles.css`) — no UI framework
- Fonts: Geist, JetBrains Mono, Cairo (Google Fonts)

## Getting started

```bash
npm install
npm run dev       # http://localhost:5173
npm run build     # production build in dist/
npm run preview   # serve the production build
```

## Structure

```
src/
  App.tsx                 page composition
  data.ts                 copy: plans, prices, FAQ, specs, demo script
  styles.css              tokens + shared/section styles
  components/
    Logo.tsx              Lumia "Lo" mark + wordmark
    Terminal.tsx          Lumia Order Terminal device with live screens + printing receipt
    terminal.css
    hooks.ts
  sections/
    Hero.tsx              headline + 14-step animated demo (WhatsApp → AI → Terminal)
    Story.tsx             stats, WhatsApp, ownership, how it works, voice, menu
    Dashboard.tsx         interactive restaurant dashboard (accept / ETA / availability)
    Hardware.tsx          terminal intro, device views, terminal vs web dashboard
    Pricing.tsx           monthly / yearly plans + terminal pricing
    Chrome.tsx            header, FAQ, final CTA, footer
```

## Terminal product photo

The design places a product photo (`assets/lumia-terminal.png`) behind the terminal's live screen.
Until that file is added, the device body is drawn in CSS. To use the photo, put it at
`public/assets/lumia-terminal.png` and set `TERMINAL_PHOTO = '/assets/lumia-terminal.png'` in
`src/components/Terminal.tsx`.

## Pages

| Path | Page |
| --- | --- |
| `/` | Landing page |
| `/privacy` | Privacy Policy |
| `/data-deletion` | Data Deletion |
| `/terms` | Terms of Service (drafted, not from the design — needs legal review) |

Legacy hash links (`/#privacy`, `/#data-deletion`, `/#terms`) redirect to these paths.
Legal copy lives in `src/pages/Legal.tsx` (contact email and "last updated" date at the top).

## Deployment

Firebase App Hosting (`lumia-order-landing` backend, us-east4) rolls out every push to `main`.
It builds with Node buildpacks (`npm run build`) and runs `npm start` → `server.js`, which serves
`dist/` on `$PORT` with an SPA fallback.

## TODO

- Set `VITE_ADMIN_URL` at build time (e.g. `https://app.order.lumia.ae`) so *Sign in* → `/login` and *Start free* → `/signup`. Unset in production, the buttons keep their old anchors; unset in local dev, they point to `http://localhost:3000`.

## Business-owner application

The separate Next.js dashboard lives in [`apps/admin`](apps/admin/README.md). It uses MongoDB and WhatsApp code verification. See its README for local setup and credentials. The landing page’s build and deployment remain independent.
