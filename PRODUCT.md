# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users
Restaurant owners and staff in the Gulf (UAE first; GCC phone codes and currencies supported). They run busy kitchens, already take orders over WhatsApp by hand, and judge a tool by whether it saves staff time and keeps orders from slipping. The landing page's job is to convince these owners to start a trial.

## Product Purpose
Lumia Order is an AI ordering employee that takes restaurant orders on WhatsApp (English and Arabic, including voice notes), confirms the exact summary with the customer, and places the order. Orders reach the restaurant's dashboard and a dedicated ordering terminal. Success for this landing page is a visitor signing up for the free trial.

## Positioning
An AI employee paired with a dedicated Lumia Order terminal: the order arrives with a loud alarm, staff accept or reject with a ready time, and the receipt prints. The restaurant keeps its own customer relationship and WhatsApp number; Lumia runs the subscription itself rather than taking a commission per order.

## Operating Context
- Customers order in a WhatsApp chat; the AI replies, reads the menu, and confirms before saving.
- Staff use the web dashboard or the terminal (Senraise Android device, Flutter app); the first to decide wins.
- Plans are Starter, Plus and Pro with monthly order limits, plus a 14-day free trial; prices are in AED before 5% VAT (see `PLANS_AND_LIMITS.md`, `apps/admin/src/modules/billing/plans.ts`).

## Capabilities and Constraints
- This repo holds the landing page (Vite, React 19, TypeScript, plain CSS tokens in `src/styles.css`), the admin dashboard (`apps/admin`, Next.js) and the terminal app (`apps/terminal`, Flutter). This record is scoped to the landing page; the admin and terminal are context only.
- Landing pages: `/`, `/privacy`, `/data-deletion`, `/terms` (terms drafted, needs legal review).
- Copy lives in `src/data.ts`. The landing page supports Arabic alongside English.
- Undecided: VAT/TRN display and company legal details (waiting on a TRN; see `BACKLOG.md`). The landing page has no analytics yet.

## Brand Commitments
Name "Lumia Order"; "Lo" mark and wordmark (`src/components/Logo.tsx`); brand colours #FF5577 and #C93DFF (per `BACKLOG.md`). The landing page was implemented from the Claude Design file "Lumia Order Landing v4".

## Evidence on Hand
Real product exists: working admin dashboard and terminal app. A terminal product photo (`public/assets/lumia-terminal.png`) is not yet supplied. Not yet tried on a real WhatsApp chat or a real unit in a restaurant, so there are no customer testimonials, case studies or order-volume claims to use; do not fabricate them.

## Product Principles
- Show the real mechanism: WhatsApp message to AI to terminal to printed receipt.
- Speak to owners' operational worries (missed orders, staff time, commissions), not AI hype.
- Arabic and English are equal citizens.
- Claim only what the product does today; no invented proof.
