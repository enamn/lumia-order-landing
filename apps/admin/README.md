# Lumia Order admin

Separate Next.js application for business owners. The marketing app at the repository root retains its own dependencies, build, and deployment.

## Current flow

Mobile number (country picker) → WhatsApp code (SMS fallback button) → "Number verified" → restaurant name + logo → menu upload (AI) → review & confirm → dashboard. A returning owner goes straight to the dashboard. Sessions last 30 days and are HttpOnly cookies; no token is stored in localStorage.

The screens are the Claude Design file `Lumia Order Pre-Dashboard Flow v2` rendered pixel-for-pixel: `design/flow-v2.dc.html` (source) → `scripts/dc-to-jsx.py` → `src/design/DcTemplate.tsx` + `dc-hover.css` (generated, do not edit). The behaviour lives in `src/design/FlowApp.tsx`. To update the design: replace `design/flow-v2.dc.html`, run `python3 scripts/design-extensions.py` (adds the few app-only states the design does not draw: error messages, add-item dialog, hidden "Today" card) and then `python3 scripts/dc-to-jsx.py`.

Dashboard: menu (search, categories, English + Arabic names, availability switches, add item), English/Arabic (RTL) toggle saved per user, setup checklist, and the WhatsApp page. Not built yet (shown as placeholders in the design): Orders, Customers, Delivery, AI replies, the WhatsApp "Today" numbers (hidden until messages are stored). SMS delivery needs a provider in `lumia-order-api` (`SMS_PROVIDER`); until then the SMS button reports it is unavailable.

Test mode (`AUTH_TEST_MODE=true`, ignored when `NODE_ENV=production`): no WhatsApp message is sent, the code is `111111`, and "Connect WhatsApp" simulates a full Meta connection with a sample profile and 12-product catalog.

## Local setup

Requires Node 20.19+ and MongoDB running as a replica set (or Atlas).

```bash
cd apps/admin
npm ci
cp .env.example .env
# Set BETTER_AUTH_SECRET to a random secret of at least 32 characters.
npm run db:local
```

`db:local` downloads a development MongoDB binary the first time and keeps data in `.local/mongo`. Leave it running. Alternatively use `docker compose up -d --wait`.

In a second terminal, from `apps/admin`:

```bash
npm run db:setup
npm run dev
```

Open http://localhost:3000/signup. MongoDB indexes must be installed before creating accounts. Prisma 6 is pinned for its MongoDB connector; SQL migrations have been replaced with index setup. Existing production Lumia data is not imported or changed.

## Your existing MongoDB cluster

Use a dedicated `lumia_order` database in the existing cluster. Set `DATABASE_URL` in `.env` to that database's MongoDB URI. Give this application a database user scoped to the new database and permit the deployed backend's network access. Do not point this schema at existing Lumia collections. Run `npm run db:setup` against the new database once connectivity is configured.

The database credentials are server-only. MongoDB Atlas runs independently of Firebase App Hosting; the Next.js backend connects to it using the connection URI.

## lumia-order-api (WhatsApp + AI)

Everything that talks to Meta or Claude lives in the separate `lumia-order-api` service (`Documents/ChatGPT/lumia-order-api`). This app owns the UI, MongoDB and sign-in logic and calls it server-to-server:

```text
LUMIA_API_URL=http://localhost:4000
INTERNAL_API_KEY=<same 32+ character secret as in lumia-order-api>
```

- **Verification code:** generated and verified here (only a keyed hash is stored, 5 minutes, 5 attempts, one use); delivered by `POST /internal/whatsapp/verification-code` (or `/internal/sms/verification-code`).
- **AI menu import:** the uploaded file goes to `POST /internal/menu/extract`; the draft comes back for review and is saved here on confirm.
- **Linking the owner's WhatsApp (Meta Embedded Signup):** the browser runs the Facebook SDK login and posts `{code, wabaId, phoneNumberId}` to `POST /api/v1/businesses/:id/whatsapp/connect`. The API exchanges the code, verifies the granted permissions (`whatsapp_business_management`, `whatsapp_business_messaging`) and that the WABA/number really belong to that token, subscribes our app to the WABA and registers the number. This app stores the business token **encrypted** (AES-256-GCM, `WHATSAPP_TOKEN_ENCRYPTION_KEY`) and marks the setup step done. Also: import profile (name, logo, address) with review, import the WhatsApp catalog as the menu (use or replace), disconnect. One number can belong to only one restaurant. Customer messages are not stored or answered yet.

Needed for real linking: `NEXT_PUBLIC_META_APP_ID`, `NEXT_PUBLIC_META_CONFIG_ID` (your Embedded Signup configuration; include `catalog_management` if you want catalog import), `WHATSAPP_TOKEN_ENCRYPTION_KEY` (`openssl rand -base64 32`), and in the API `META_APP_ID`, `META_APP_SECRET`, `WHATSAPP_REGISTRATION_PIN`. Facebook login generally requires HTTPS and the domain listed in the Meta app, so the real popup may need an HTTPS tunnel locally; test mode covers the UI meanwhile.

If the API is not running or the keys do not match, the UI reports the service as unavailable; there is no fixed OTP outside test mode. Server-side limits allow one code per minute and five per phone per hour.

## Development seed

Optional: set `ALLOW_DEMO_SEED=true` and `DEMO_PHONE_NUMBER` to an E.164 development number, then run `npm run db:seed`. The seed creates demo catalog data and is repeatable. Sign-in still requires a WhatsApp code sent to that number. There is no email/password login.

## Verification

```bash
npm run typecheck
npm test
npm run test:db
npm run build
```

Database tests start a fresh isolated MongoDB replica set and never connect to the configured remote database. The first run downloads a MongoDB test binary. Integration tests mock only Meta delivery and exercise actual MongoDB transactions, Better Auth cookies, code limits, account creation, and tenant boundaries.

With the local preview and MongoDB running:

```bash
npx playwright install chromium
E2E_LOCAL_DB=true npm run test:e2e
# Or use installed Chrome:
E2E_LOCAL_DB=true PLAYWRIGHT_CHANNEL=chrome npm run test:e2e
```

Browser tests intercept only the send-code request to substitute provider delivery. The running app verifies the generated code, creates a session, saves the restaurant, and resumes saved data. The test creates test data in the local preview database. Never run this command against a production database.

Set `NEXT_PUBLIC_MARKETING_URL` to the landing page's public URL when deploying; Terms and Privacy links point there. The admin application needs a separate full-stack hosting backend and server-side secret configuration.

## Deploying (app.order.lumia.ae)

Layout: `order.lumia.ae` = landing page, `app.order.lumia.ae` = this app, `api.order.lumia.ae` = `lumia-order-api`.

1. **MongoDB.** Create a hosted database (MongoDB Atlas, or a dedicated `lumia_order` database in your cluster). Allow the host's network access. Then, once, from `apps/admin` with the production `DATABASE_URL` in your shell or `.env`: `npm run db:setup` (creates collections and indexes).
2. **Host.** Firebase App Hosting (`apphosting.yaml`, root directory `apps/admin`) or any container host (`Dockerfile`, build context `apps/admin`, `--build-arg NEXT_PUBLIC_MARKETING_URL=https://order.lumia.ae`). Health check: `GET /api/health`.
3. **Secrets:** `DATABASE_URL`, `BETTER_AUTH_SECRET` (32+ random chars), `INTERNAL_API_KEY` (same value as in the API), `WHATSAPP_TOKEN_ENCRYPTION_KEY` (`openssl rand -base64 32`; losing it makes stored WhatsApp connections unreadable, so back it up). **Do not set** `AUTH_TEST_MODE` or `WHATSAPP_LINK_TEST_MODE` in production (they are also ignored when `NODE_ENV=production`).
4. **DNS/HTTPS:** point `app.order.lumia.ae` at the host (managed certificate).
5. **Landing page:** set the build-time variable `VITE_ADMIN_URL=https://app.order.lumia.ae` on the landing host and redeploy.
6. **API host:** `INTERNAL_API_KEY`, `META_APP_ID`, `META_APP_SECRET`, `WHATSAPP_REGISTRATION_PIN`, `ANTHROPIC_API_KEY` (+ `ANTHROPIC_WORKSPACE_ID`), the WhatsApp template settings, and keep its port private.
7. **Meta app:** add `app.order.lumia.ae` to App Domains and to the Facebook Login allowed JavaScript SDK domains; the webhook callback stays `https://api.order.lumia.ae/webhooks/whatsapp`.
8. **Real sign-in codes:** WhatsApp authentication template approved in Meta and `META_AUTH_TEMPLATE_NAME` set in the API (SMS is not wired yet).

