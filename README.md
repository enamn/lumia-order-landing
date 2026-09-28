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

## TODO

- Real targets for *Sign in*, *Privacy Policy*, *Data Deletion* and *Terms* (currently `#` anchors).
