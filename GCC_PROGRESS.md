# GCC support: progress checkpoint (updated 7 Oct 2026)

Source: `~/Desktop/Lumia_Order_GCC_Implementation_Brief_for_Claude.md`. Built in points, each tested, committed and pushed. UAE behaviour is unchanged.

## Done
1. **Country list = the six GCC countries only** (sign-in picker and server). Phone numbers validated with libphonenumber (max metadata): valid mobile numbers only, typed numbers turned into E.164.
2. **Country per restaurant.** `Business.countryCode/currencyCode/timezone` set from the chosen country (default from the owner's phone). One account per country, country locked once real records exist (`COUNTRY_CHANGE_NOT_ALLOWED`). Market switches (registration, paid plans, sign-in code, WhatsApp set-up, terminals) in the DB and in the super admin page, with a change log. UAE live; the other five "configured" (open for set-up, paid plans off).
3. **Money in each currency.** AED/SAR/QAR 2 decimals, OMR/BHD/KWD 3. Menu, orders, delivery fees, minimum order, summaries, WhatsApp replies, AI prompt and menu reading, dashboard and settings all use the restaurant's currency (ISO code). Arabic digits accepted when typing prices.
4. **Regions per country** (UAE emirates, Saudi regions, Omani and Bahraini governorates, Qatari municipalities, Kuwaiti governorates; English and Arabic words, well-known cities). Branches and delivery areas are validated against the restaurant's country on the server. Map lookups are limited to that country and the result must be in it. AI gets the country's regions. Settings labels say Emirate/Region/Governorate/Municipality. (API repo: geocoder + reply AI updated; API commit is pushed.)

5. **Tax and billing (tax on Lumia's own subscriptions, not on restaurants' food orders).**
   - Decision engine (`modules/tax/policy.ts`): who may be sold to and what tax applies. UAE: always, no VAT while Afkar IO's UAE VAT registration is inactive (it is, by default), 5% once an active registration with a number and start date is recorded. Saudi Arabia/Oman/Bahrain: only a business with a verified local VAT registration, reverse charge, no destination VAT. Qatar/Kuwait: sold to, no local VAT. Foreign sales after Afkar registers need an approved per-country policy, otherwise they go to review.
   - Afkar registration, policies, VAT review queue (approve/reject with evidence reference, method, validity), prices and market switches are in the super admin page, all audited. The customer fills Billing → Tax details (legal name, address, VAT number); changing approved details sends it back to review.
   - Every paid action (checkout, renewals, upgrade, extra orders, extra branch) checks eligibility and uses the decision's rate; invoices keep the decision. A failed tax review at renewal uses the renewal grace period. Invoices say "Invoice" (not "Tax invoice") without a registration.
   - Saudi/Omani/Bahraini restaurants can set up without limit but go live (and start the 14-day trial) only when the VAT registration is verified.
   - Prices per market: the UAE list is fixed in code; other markets use only prices approved in the super admin (all 10 items), only in their own currency, only when the currency is enabled (`STRIPE_ENABLED_CURRENCIES`, default AED) and paid plans are switched on for the market. Three-decimal currencies are charged in steps of 10 (Stripe rule). Software-only plans (no terminal) work everywhere; terminals are sold only in the UAE.
   - Turnover monitor for the AED 375,000 UAE VAT threshold (rolling 12 months and a forecast): a report and alert only, never an automatic registration.

## Not done yet (brief sections)
- **Waiting on you / outside code:** confirm with Stripe which of SAR, OMR, BHD, QAR, KWD the UAE account can charge (I need your OK to use the Stripe key), the real prices for each country, Afkar's actual UAE VAT registration status, your accountant's view on withholding/retention and the policies for foreign sales, a new Resend key, and the super admin phone number.
- **Restaurant food-order VAT: not needed (decision, 7 Oct 2026).** Lumia only shows the prices the restaurant puts in its menu and handles no restaurant VAT or payments. The only VAT Lumia handles is on the restaurant's subscription to Lumia (done in point 5).
- **Operations:** distance-tier delivery rules with explicit boundaries and `distance_method`, analytics grouped by currency, promo-code currency scope, terminal tickets in 3-decimal currencies/Arabic.
- **Refunds and credit notes** in the original currency, **withholding tax tracking**, private **evidence file upload** (today an evidence reference text).
- **Existing-data migration check** of the live UAE restaurant (defaults already AE/AED/Asia/Dubai; no data was changed).
- **Landing page:** still UAE-oriented copy; the GCC landing text and analytics deploy need the `main` merge.

- **Restaurant switcher: not needed (decision, 7 Oct 2026).** A brand in two countries uses two separate accounts, each with its own subscription.
- **Time zones: done (decision, 7 Oct 2026).** One time zone per country (UAE/Oman Dubai/Muscat, Saudi/Kuwait/Bahrain/Qatar +3), no per-branch zone. Restaurants take it from their country; reminder emails and offer dates now use it. Platform analytics days stay on Dubai time.
