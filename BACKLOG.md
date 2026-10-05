# Lumia Order: to do later

## Super admin (internal tool, not built yet)
- **Company and VAT settings.** Lumia's legal name, tax registration number (TRN) and address. While there is no TRN: no VAT is charged, no VAT line is shown, and invoices say "Invoice". With a TRN: VAT (5%) is added and invoices say "Tax invoice" with the number. Decide then whether prices stay "plus VAT". (Today the app always adds 5% VAT and invoices show "Lumia Order" only. Env vars `LUMIA_LEGAL_NAME`, `LUMIA_TRN`, `LUMIA_ADDRESS` exist for the invoice page.)
- **Terminal shipments.** See every terminal order, set its stage (preparing / shipped / out for delivery / delivered) and tracking number, and see the delivery address. Today this is edited by hand in the database.
- **Orders and clients.** View all restaurants and their customers, and the orders across restaurants (read-only to start).
- **Support.** Look up a restaurant, see its plan, payments, connection status and recent errors, and help the owner. Includes the actions below.
- **AI failure logs.** A list of the cases where the AI could not answer or order (reply failed, voice transcription failed, order draft rejected, WhatsApp not connected, and so on), with the reason, the time, the restaurant and the conversation, so the cause of each error can be checked. (Today these only appear in the server logs as `AI_REPLY_FAILED`, `VOICE_TRANSCRIBE_FAILED` and similar.)
- **Analytics.** Landing page: visitors, clicks on "Sign up" / "Sign in", and how many go on to create an account. Also sign-ups per day, trials started, trial-to-paid conversion, active restaurants, orders and messages per day. (The landing page has no tracking yet.)
- **Subscriptions.** View, extend a trial, give a free plan, refund, fix a failed renewal.

## Billing
- Tell the owner (WhatsApp or email) when a renewal fails, before the plan lapses.
- Decide what happens when a trial expires or a plan lapses (today only the plan-only features lock; WhatsApp replies keep working).
- Enforce the staff-account and WhatsApp-number limits per plan (shown in the plan text, not enforced).
- Show Stripe's fee and the net amount per payment.
- A second payment provider for GCC cards (local schemes are usually cheaper than international card rates), chosen per restaurant.
- Go live on Stripe: live keys, a live webhook endpoint (`checkout.session.completed` only), branding (logo `apps/admin/public/brand/lumia-mark.png`, colours #FF5577 / #C93DFF).
- Test data from the first test payment is still in Stripe (test mode) and in the database (1 subscription, 1 invoice). Left as is on purpose.

## Platform
- Rotate the Atlas database password (it was shown once in chat) and update the `lumia-order-database-url` secret.
- Speed: move the apps and database closer to the UAE (for example europe-west4), and keep one instance warm (`minInstances: 1`).
- Meta App Review: advanced access, screencast, terms and data-deletion URLs, business verification.
- SMS provider for the code fallback.
- Merge `codex/admin-dashboard` into `main`.

## Product
- Team members page (the old Settings had it; the new design does not).
- Customers page, Messages page (hidden from the menu, still at /dashboard/messages).
- Order terminal app: pairing, receipt printing (the Devices page and "Print receipt" are placeholders).
- Settings the AI does not use yet: delivery fee rules, WhatsApp number routing, payment options, opening hours (hours are saved per branch, not yet enforced when taking orders).
- Branch pin: search by address and a map picker (today: current location or a pasted Google Maps link).
- Speech-to-text: real-voice test of OpenAI and Google, then choose a provider per plan.
