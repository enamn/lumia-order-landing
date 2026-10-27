# WhatsApp interactive menu trial

This is the first trial from the supplied implementation brief. It replaces the long menu dump with categories → products → details → cart, while reusing the existing AI draft, branch catalog selection, delivery calculator, order creation and terminal notification services. Interactive browsing is **opt-in per business**. Existing businesses keep their current flow until it is enabled.

## What changed, by file

| File | Responsibility |
| --- | --- |
| `src/modules/messages/menu-presentation.ts` | AR/EN welcome, categories, products, details and branch screens; pagination; currency formatting; safe labels; opaque screen actions. |
| `src/modules/messages/menu-controller.ts` | Resolve actions in durable conversation state, recheck availability, mutate the existing draft, hand checkout to the existing AI flow, track orders and route customization to staff. |
| `src/modules/messages/ai.ts` | Load current menu metadata; apply the existing agent, branch, hours, usage and human-takeover guards before browsing; recheck current prices before template confirmation. |
| `src/modules/messages/inbound.ts` | Retain action IDs; deduplicate inbound messages using the existing index; separate conversations by receiving number. |
| `src/modules/messages/reply.ts` | List descriptions and actionable text fallback using `M1`, `M2`, etc.; reuse the image sender. |
| `src/modules/messages/welcome.ts` | Native action buttons on chat-open welcome when enabled. |
| `prisma/schema.prisma` | Optional `Conversation.menuSession` and `Message.interactiveId`; no destructive migration. |
| `src/components/ai-settings.tsx`, `menu-preview.tsx`, `src/app/globals.css` | Business setting and a local, interactive AR/EN preview. |
| `src/app/api/v1/[...path]/route.ts` | Authorized, read-only preview data. |
| Companion API `src/services/whatsapp.service.ts`, `src/types/whatsapp.types.ts` | Preserve `button_reply.id` and `list_reply.id` separately from translated titles. |
| Companion API `src/services/whatsapp-sender.service.ts`, `src/routes/internal.routes.ts` | Price descriptions in list rows, validate choice limits, and retain the existing configured Graph version and tenant credentials. |

## Behavior

- A typed menu request opens categories directly. Greetings show View Menu / Offers / Track Order.
- Categories, products and branches paginate with navigation inside the ten-row maximum. Reply-button screens have at most three buttons.
- Product details show exact current price in the business currency. A catalog image is sent separately when available.
- Add to cart adds one unit to `Conversation.draftOrder`; customers can type quantities, removals, notes and fulfillment changes through the existing AI flow. Checkout continues through the existing COD confirmation and terminal pipeline.
- Each action is an opaque reference into the current server-side session. Previous screens expire when a new screen is sent, and after two hours. Actions cannot refer directly to arbitrary products or branches. The receiving number and branch must match the session. Conversation updates use a compare-and-swap check.
- Unavailable items are hidden and checked again on Add and confirmation. Changed prices invalidate a pending review.
- Interactive replies are checked against the latest inbound 24-hour window. Existing human takeover, usage and rate guards still apply.
- An unsupported interactive send falls back to a short text choice list. Reply `M1` rather than a bare number, avoiding confusion with quantities.
- The Offers button checks no invented promotions: it explains that a customer can supply a code for the existing code validator. Track Order reports the most recent order in the same conversation.

## Configure and trial

1. Deploy the dashboard first with the generated Prisma client, leaving interactive menus disabled. Then deploy the companion API with action-ID forwarding and row descriptions. Both services must be updated before enabling the trial.
2. Reuse the existing `DATABASE_URL`, `WHATSAPP_TOKEN_ENCRYPTION_KEY`, `LUMIA_API_URL`, `INTERNAL_API_KEY` and connected business-number credentials. Do not put secrets in fixtures or client code. The webhook keeps its existing signature verification.
3. In **Messages → Assistant settings**, enable “Let customers browse categories and products inside WhatsApp”, then Save settings. The equivalent authorized setting is `POST /api/v1/businesses/<businessId>/ai` with `{"interactiveMenu":true}`.
4. Open **Preview customer menu** to test AR/EN, branch menus, product details and a simulated cart without sending or placing orders.
5. For a live sandbox check, the allowed test recipient messages the connected test sender first. Reply `منيو` or `menu`, then browse, add a simple item, choose checkout, give pickup/delivery details and explicitly confirm. Actual checkout creates a real order in that business's dashboard/terminal.
6. Disable the setting to restore ordinary AI replies. Existing carts remain available. No templates are submitted and no campaigns are sent.

MongoDB has optional added fields; regenerating Prisma is required. No production schema push or data rewrite was performed here.

## Verification

Dashboard production build and both TypeScript checks pass. Tests use isolated temporary MongoDB, never the production catalog.

```sh
# apps/admin
npm run db:generate
npm run build
RUN_DB_TESTS=true npm test -- --run tests/menu-interactive.test.ts tests/menu-presentation.test.ts tests/reply.test.ts tests/inbound.test.ts tests/ai.test.ts tests/orders.test.ts tests/open-hours.test.ts tests/branch-location.test.ts

# companion lumia-order-api
npm run typecheck
npm test
```

Coverage includes pagination, emoji/Arabic truncation, three-decimal currency, list fallback, stale/replayed IDs, duplicate inbound delivery, stock changes, changed confirmation prices, receiver-number isolation, expired chat windows, COD checkout once, and staff handoff for configured options. Fixtures below use illustrative identifiers and no credentials.

## Remaining work from the full brief

- **Variants and add-ons:** the existing WhatsApp draft/pricer does not model selections. This trial hands these products to staff and blocks adding them at a misleading base price. Automatic selection, pricing, terminal snapshots and constraints still need an extension to the canonical order model.
- **Large mobile-menu fallback:** the app currently has no public customer menu page. This trial paginates the first 400 loaded items; a real public menu URL and larger-catalog cursor queries remain to be built.
- **Configuration:** custom welcome text is reused. Featured categories, an unavailable-item display policy and a configured default language are not new controls in this trial. Normal replies auto-detect AR/EN.
- **Outreach templates:** dynamic in-window menus need no template. Marketing menu invitations, opt-in-based outreach and Utility order updates outside the service window remain separate; no submissions were made.
- **Future scope:** Meta Commerce catalogs, campaigns and payment links are outside this trial.
- Live deployment completed on 2026-10-27: dashboard revision `lumia-order-landing-1-build-2026-10-27-004` and API revision `lumia-order-api-build-2026-10-27-001`. Both health endpoints returned 200. Interactive menus were enabled only for Burger House and the native Arabic preview was sent to the authorized test recipient. Customer tap-through and a real terminal order remain to be manually verified.

References: [Meta list example](https://www.postman.com/meta/whatsapp-business-platform/request/0v36tbh/send-reply-to-list-message), [Meta interactive message structure](https://whatsapp.github.io/WhatsApp-Nodejs-SDK/api-reference/messages/interactive/).
