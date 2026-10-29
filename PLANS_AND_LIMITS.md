# Lumia Order — Plans, limits, branches and menus (flow)

Status: built and pushed on `codex/admin-dashboard` (admin) and `master` (API). Not yet tried on a real WhatsApp chat.
Numbers live in `apps/admin/src/modules/billing/plans.ts` and can be changed there.

## 1. Plans at a glance

| | Starter | Plus | Pro | Free trial (14 days) |
|---|---|---|---|---|
| Price / month (before 5% VAT) | AED 149 | AED 249 | AED 399 | free |
| **WhatsApp orders / month** | **100** | **150** | **250** (+80 per extra branch) | 20 |
| Branches | 1 | 3 (fixed, cannot add more) | 3 included, extra branch **AED 99/month** (AED 990/year) | 1 |
| Menus | 1 menu | 1 menu shared by all branches | shared menu **or** a separate menu per branch | 1 |
| Staff accounts | 1 | 3 | 10 | 1 |
| Customers page, calling customers by name | no | yes | yes | name use during trial |
| AI menu reading (hidden fair use) | 3 / month | 10 / month | 30 / month | **2 in total** |
| Voice notes (hidden fair use) | 60 / month | 120 / month | 200 / month | 20 |
| AI replies (hidden fair use) | 15 per order of the limit | 15 per order | 15 per order | 15 per order |

- Limits count from each restaurant's own billing day (monthly, even on yearly plans).
- Upgrading raises the limits immediately.
- The WhatsApp Business number serves **all branches** (a number is not tied to one branch).
- The Lumia Order terminal receives the branch's orders live (alarm), lets staff accept/reject with a ready time, and prints receipts. The dashboard can do the same; the first to decide wins. (Terminal app: `apps/terminal`, protocol: `TERMINAL_PROTOCOL.md`.)

## 2. What counts as an order

A WhatsApp order **placed by the assistant** after the customer confirmed the exact summary. It is counted at the moment it is saved. If saving fails, the order is not counted.

## 3. When the limit is reached

```
Customer message arrives
 ├─ flood guard: more than 10 messages in 2 minutes from one customer
 │     → 11th gets one "slow down" message, later ones are ignored
 ├─ no order in progress AND no orders left (monthly + bought)
 │     → "Someone from the restaurant will assist you soon" (EN + AR, at most once an hour)
 │       no AI call is made, the message stays in the inbox for the owner
 ├─ order already in progress
 │     → may finish, up to +10% of the monthly limit (Starter +10 orders)
 │       beyond that → same "someone will assist you soon" message, draft is kept
 └─ otherwise → the assistant answers
```

- The AI failing never leaves the customer in silence: they get "Sorry, I couldn't process that, please send it again", and nothing is counted.
- Customer messages are cut to 1,000 characters.
- Voice notes over the plan's allowance: the customer is asked to type instead.
- AI menu reading over the allowance: the owner sees an error and can add items manually or upgrade.

## 4. Extra orders (top-up)

Bought on **Billing → Orders this month**, charged to the card on file with 5% VAT, an invoice is written.

| Pack | Price (before VAT) |
|---|---|
| 50 extra orders | AED 99 |
| 200 extra orders | AED 349 |

- Used only after the monthly orders, and never expire.
- A pack always costs more per order (AED 1.98 and 1.75) than any plan (Starter 1.49, Plus 1.66, Pro 1.60), so upgrading is always the better deal.
- Needs an active plan with a card; not allowed while a renewal is overdue.
- A double click charges once; a failed card adds nothing.

## 5. Branches

```
Starter ── 1 branch
Plus ───── 3 branches (no more can be added)
Pro ────── 3 included + extra branches at AED 99/month each
```

- Only **active** branches count; a switched-off branch is free.
- **Adding an extra branch (Pro):** Settings → Branches → Add branch (or Billing → Branches → Add a branch).
  - Confirm dialog shows the price; you pay the **prorated** amount for the rest of the period now (+ VAT), card on file.
  - From the next renewal it is a line on the plan price ("Extra branch × N").
  - Each extra branch adds **+80 orders** a month.
- **Removing an extra branch:** Billing → Branches → "Remove one at renewal" (takes effect at the next renewal, nothing refunded). Active branches beyond the new total must be switched off first.
- **Downgrades** (e.g. Pro → Plus/Starter) are blocked while more branches are active than the smaller plan allows.

## 6. Menus

| Plan | Menu |
|---|---|
| Starter | one menu (can be edited and updated) |
| Plus | one menu used by all branches |
| Pro | **All branches (shared menu)** or **a branch's own menu** |

**Pro, Menu page → "Menu for" selector**
- *All branches (shared menu)*: used by every branch that has no menu of its own.
- *A branch with no own menu*: uses the shared menu; changes made there update the shared menu. Buttons: "Give this branch its own menu (copy of the shared menu)" or "Start an empty menu".
- *A branch with its own menu*: changes only affect that branch. Button: "Use the shared menu instead" (its menu is set aside, not deleted).
- AI menu import, adding items and WhatsApp-catalog import apply to the selected menu.
- On a downgrade, branch menus are kept but ignored; on re-upgrade they come back.

## 7. How the assistant picks the branch (Pro with at least one branch menu)

Restaurants with a single menu are unchanged. For Pro with branch menus:

```
Customer starts chatting
 ├─ branch not known yet
 │    The assistant has NO menu and cannot take an order. It asks pickup or delivery:
 │      • delivery → asks for the WhatsApp location pin
 │      • pickup   → asks "Which branch?" (lists the branches)
 ├─ location pin received
 │    → nearest active branch (that has a map pin) is chosen automatically
 │    → pin near a different branch later: branch switches and the half-made order is dropped (menus differ)
 ├─ customer names a branch (pickup) → that branch is saved for the chat
 └─ branch known → the assistant loads that branch's menu (or the shared one if the branch has none)
                   → the order is saved with that branch
```

Only one active branch means that branch is used automatically.

## 8. Billing page (restaurant owner view)

- **Orders this month:** one bar "WhatsApp orders 37 / 100", "63 orders left", warning at 80%, red notice at 100%, "Add 50 / 200 orders" buttons. Voice, AI imports and AI replies show only when ≥ 80% used.
- **Branches:** "3 active of 3 branches", extra branch price, add / remove-at-renewal buttons (Pro).
- **Invoices:** extra orders show as "Extra orders", extra branches as their own invoice.

## 9. Money flow

- Subscriptions are run by Lumia; Stripe only takes payments and keeps the card.
- Renewal charge = plan + extra branches (+ 5% VAT), retried after 1, 3 and 5 days, then the plan lapses.
- Top-ups and extra branches are charged immediately off-session with idempotency keys.

## 10. Cost basis (assumption to verify)

About **AED 0.56 of AI cost per order** (≈ 7 AI replies at ≈ AED 0.08), so a plan used to its limit costs ≈ 38% / 34% / 35% of its price (Starter / Plus / Pro). The API now logs real token counts (`reply.ai.usage`); re-tune `LIMITS`, `TOPUPS` and the branch price after a few days of real traffic. Prompt caching or a cheaper model for simple turns would allow higher limits.

## 11. Not done yet (see `BACKLOG.md`)

- Owner alerts (email / WhatsApp / Overview banner) at 80% and 100% of orders.
- Super admin: change a restaurant's limits, grant free orders, global AI ceiling, VAT and company details.
- Setup readiness is still business-wide (a Pro branch with an empty own menu is not flagged).
- Delivery by area (no pin) does not pick a branch yet; the assistant asks for the pin.
- "WhatsApp number routing" setting is saved but not used.
- Terminal pairing and printing (orders are manual today).

## 12. Finding the customer's location (WhatsApp has no app GPS)

The assistant works down this ladder and never gets stuck:

1. **One-tap "Send location" button** under its message (WhatsApp location request). Falls back to plain text (📎 → Location) if WhatsApp refuses the button.
2. **Restaurant's own area rules**: if the customer names an area/emirate that an area rule (or "All areas of <emirate>", or free delivery) assigns to a branch, that branch is used with no pin.
3. **Typed address**: an address-looking message ("Pearl tower 804 near the corniche") is looked up on the map; the assistant asks the customer to confirm the place it found; once confirmed it works like a pin (nearest branch, distance fee).
4. **Returning customers**: saved addresses carry their pin; for pickup the last branch is offered first.
5. **Won't share**: the customer picks the branch (WhatsApp buttons for up to 3 branches, a list up to 10) and continues; a restaurant using manual fees confirms the fee itself.

Replies to the buttons/list arrive as normal text. Pickup never needs a location.

## 13. Order review with the approved template

`lumia_order_review_confirm_v1` (customer name, order number, restaurant, items one per line, total; buttons **Confirm order** / **Change order**) replaces the "reply YES" step:

1. When the order is complete (items, fulfilment, address, location/fee, name, address label), the order is saved with its number as *awaiting customer confirmation*. Only the customer sees it: it is hidden from the Orders page, the stats and the monthly order count.
2. The customer receives the template.
3. **Confirm order** → the order goes to the restaurant (status "awaiting restaurant"), counts as one order of the plan, the delivery address is saved under its name and the customer gets "Order #N received". No AI call is used. Typing "yes" does the same.
4. **Change order** → the pending order is removed (its number is free again), the draft is kept and the assistant asks what to change; the changed order is reviewed again with a new template.
5. Editing the order after the template replaces the old review; an order that becomes incomplete is no longer waiting for a tap.
6. At the plan's order limit the tap is answered with "Someone from the restaurant will assist you soon" and the order stays pending.
7. If the template cannot be sent (not approved, wrong language code, WhatsApp error) the old text summary and YES are used, so ordering never stops.

Items go out one per line; if WhatsApp refuses line breaks in a parameter the same message is sent with " | " between items. Template name/language are API settings: `META_ORDER_REVIEW_TEMPLATE_NAME` (default `lumia_order_review_confirm_v1`) and `META_ORDER_REVIEW_TEMPLATE_LANGUAGE` (default `en_US`; must match the approved template's language code). Button texts recognised: "Confirm order" / "Change order" (and Arabic "تأكيد الطلب" / "تعديل الطلب").

## 14. Trial and plan expiry (access, lock, emails)

| State | Dashboard | WhatsApp assistant |
|---|---|---|
| Free trial (14 days) | works | works |
| Paid plan (`ACTIVE`) | works | works |
| Renewal failed (`PAST_DUE`): **grace period** while the card is retried after 1, 3 and 5 days (about 9 days in total) | works | works |
| Trial over, plan cancelled/ended, or retries used up | **locked: only the plans screen (and Log out)** | **fully off**; incoming messages are still stored. The number stays connected. A customer who writes gets one short notice a day (English + Arabic) to contact the restaurant directly; the owner is emailed (see below) |

- Paying a plan unlocks everything at once. Server side, every dashboard API except subscription/billing answers `402 SUBSCRIPTION_REQUIRED` while locked.
- Emails (from `noreply@…`, sent by lumia-order-api through Resend, to the restaurant's **verified contact email**; English or Arabic by the owner's language), each sent once per period by the hourly billing job: trial ends in 3 days, trial ends tomorrow, trial ended, plan ends in 3 days / tomorrow (cancelled plans), renewal failed (with the date the grace period ends), plan ended.
- **Banks that ask for 3-D Secure:** a charge made without the cardholder present can be refused with “authentication required”. A renewal in that case is retried like any failed renewal, but the owner gets a specific email (“Your bank needs you to confirm your renewal”) and the Billing page says to choose **Update card** and enter the card again (the card form does the bank check once). Upgrades, top-ups and extra branches show the same instruction instead of a generic failure. Not built: confirming a single payment on the spot (needs the payment service to hand back the Stripe client secret).
- **Customers writing after expiry** (trial ended or plan ended, not VAT setup): the first 3 customers of that lock period each trigger an email to the owner (“<name> wrote to you on WhatsApp”); after that, one summary email a day. These are not held back by the one-email-a-day limit. The customer notice is skipped when the owner turned automatic replies off, and for STOP/START words. Choosing a plan switches everything back on at once; the number is never disconnected.
- Setup needed on lumia-order-api: `RESEND_API_KEY` and `EMAIL_FROM` (default `Lumia Order <noreply@order.lumia.ae>`); the sending domain must be verified in Resend. Until the key is set, no email goes out and the job retries every hour.
- **Contact email:** phone sign-ups have no real email, so every restaurant without a verified one sees a banner at the top of the dashboard ("Add your email to get plan reminders") with the address field and a 6-digit code sent by email (valid 10 minutes, 30 s between codes, 5 codes an hour, 5 wrong guesses). The same address and a Verify button are in Settings → Profile → Email; changing the address un-verifies it. No verified email, no reminders.


## Testing billing (sandbox)

- Set `BILLING_SANDBOX=true` on the app (test Stripe keys only). A month then lasts **1 minute**, a year **1 hour**, and the retry schedule (1, 3, 5 days) runs in **1, 3, 5 minutes**. Receipt emails show the time of day.
- Run `sh apps/admin/scripts/billing-sandbox.sh` to charge what is due every 20 seconds (in production Cloud Scheduler calls the same job hourly).
- Test cards: `4242 4242 4242 4242` pays; `4000 0000 0000 0341` attaches fine and then fails on renewal (retry path); `4000 0025 0000 3155` asks for 3-D Secure.
- Apple Pay and Google Pay come with Stripe's payment form. They need to be switched on in the Stripe dashboard (Settings, Payment methods) and the app's domain registered for Apple Pay (Payment method domains). They are saved as cards and show in Billing with their wallet name.
- Emails sent: subscribed, renewed, upgraded, extra orders added, extra branch added, renewal failed (each retry), bank confirmation needed, plan ended.
