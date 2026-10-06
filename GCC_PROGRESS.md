# GCC support: progress checkpoint (6 Oct 2026)

Source: `~/Desktop/Lumia_Order_GCC_Implementation_Brief_for_Claude.md`. Built in points, each tested, committed and pushed. UAE behaviour is unchanged.

## Done
1. **Country list = the six GCC countries only** (sign-in picker and server). Phone numbers validated with libphonenumber (max metadata): valid mobile numbers only, typed numbers turned into E.164.
2. **Country per restaurant.** `Business.countryCode/currencyCode/timezone` set from the chosen country (default from the owner's phone). One account per country, country locked once real records exist (`COUNTRY_CHANGE_NOT_ALLOWED`). Market switches (registration, paid plans, sign-in code, WhatsApp set-up, terminals) in the DB and in the super admin page, with a change log. UAE live; the other five "configured" (open for set-up, paid plans off).
3. **Money in each currency.** AED/SAR/QAR 2 decimals, OMR/BHD/KWD 3. Menu, orders, delivery fees, minimum order, summaries, WhatsApp replies, AI prompt and menu reading, dashboard and settings all use the restaurant's currency (ISO code). Arabic digits accepted when typing prices.
4. **Regions per country** (UAE emirates, Saudi regions, Omani and Bahraini governorates, Qatari municipalities, Kuwaiti governorates; English and Arabic words, well-known cities). Branches and delivery areas are validated against the restaurant's country on the server. Map lookups are limited to that country and the result must be in it. AI gets the country's regions. Settings labels say Emirate/Region/Governorate/Municipality. (API repo: geocoder + reply AI updated; API commit is pushed.)

## Not done yet (brief sections)
- **Tax and billing (sections 5, 6, 8, 9, 17):** supplier tax profile for Afkar IO, customer billing tax profile and VAT verification (SA/OM/BH need a verified local VAT number; review queue + evidence), eligibility gate on checkout/renewals/add-ons, tax decision snapshot on invoices (today the app still adds 5% VAT to every subscription invoice: the brief says none while Afkar's UAE VAT registration is inactive), per-market plan prices (`PlanMarketPrice`, drafts for new markets), Stripe currency support check (needs the Stripe key: ask first), restaurant food-order VAT profile (inclusive/exclusive).
- **Operations:** branch timezone/hours per country (reminders, analytics and campaigns still use Asia/Dubai), distance-tier delivery rules with explicit boundaries, terminals hidden outside the UAE, restaurant switcher for a user with two accounts, analytics grouped by currency, promo-code currency scope.
- **Existing-data checks:** a migration check of the one live UAE restaurant (no data was changed; defaults already AE/AED/Asia/Dubai).
- **Landing page:** still UAE-oriented copy; the GCC landing text and the analytics deploy need the `main` merge (see the analytics notes).

## Where things are
- Admin: `apps/admin/src/modules/market/{countries,regions,money,service}.ts`, `modules/business/service.ts` (create/change country), `modules/settings/service.ts` (validation), `modules/orders/{draft,delivery}.ts`, `design/{CountryPick,SettingsApp}.tsx`, design scripts `scripts/design-extensions-country.py`, `settings-extensions-{currency,region}.py`.
- API (`lumia-order-api`): `services/{geo,reply-ai,menu-ai}.service.ts`.
- Tests: admin 226 passing (`RUN_DB_TESTS=true npx vitest run`), API 48 passing (`npm test`).
