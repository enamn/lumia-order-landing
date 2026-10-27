# Conversational carousel menu

## Current status

The user reviewed the sample and approved publishing the trial. A native eight-card send from the connected Burger House sender was accepted by Meta on 2026-10-27 using Graph v25.0. Generated card uploads used the existing media uploader. Code publication and deployment are now in progress; delivery receipts and customer tap-through must still be checked. Production settings for other businesses are unchanged.

A local review sample generated from Burger House's current catalog is at:
`/Users/ahmad/.codex/visualizations/2026/10/27/01a17cb1-7dcb-7291-be16-04e03abbd596/menu-carousel-review/index.html`

It shows the first eight of 35 available items. The sample is an approximation of WhatsApp's appearance; its Details and advice-example controls are local demonstrations. The dashboard preview uses the real presentation functions and supports every batch and active branch without sending or creating orders.

## Customer behavior

- “شو عندك؟”, “منيو” and similar Arabic/English requests open item cards directly. Longer menu requests recognized by the existing AI also open the carousel without replacing an existing draft.
- Greetings stay conversational. An unknown first-open language defaults to English; subsequent customer text or voice selects Arabic/English. Authored custom welcome text remains operator-controlled.
- Eight items per batch, grouped by configured category order and deterministic item order. Trailing single items are rebalanced (nine items become seven plus two). Zero available items produce a short notice; one item uses an image-header Details message rather than an invalid carousel.
- Cards show current names/prices with one Details action. No menu button adds items to a cart. Existing catalog photos are used when present; otherwise a deterministic branded PNG is generated with the bundled, open-licensed Noto Sans Arabic font and resvg.
- Beneath the cards: `اكتب طلبك أو ابعت فويس 🎤\nوإذا محتار، بتحب أساعدك تختار؟`, plus More/Previous navigation when applicable. Text or voice saying “المزيد” or “السابق” can also navigate.
- A yes to help asks one preference question based on actual categories. The next preference goes to the existing AI, which returns up to three menu IDs. The server filters availability and formats exact item names/prices. Free-form recommendation claims are not displayed. Unsupported dietary/allergen/ingredient assertions are forbidden.
- Advice never changes the existing cart or confirms a pending order. Even a yes to an old offer restarts the preference question rather than confirming an order. Explicit selections bypass advice and use the existing text/voice order draft and COD checkout.
- Branch, human takeover, usage, 24-hour window, availability and final price checks remain in place. Items needing variants/add-ons still require staff assistance through the established order path; this iteration adds no option-pricing system.

## Interfaces and state

- Companion API: authenticated `POST /internal/whatsapp/send-carousel` with tenant `accessToken`, `phoneNumberId`, `to`, `text`, and `cards[]` containing `image` (`id` or HTTPS `link`), `text`, `buttonId`, `buttonTitle`. Validates counts, text limits, media fields and unique IDs. One card becomes an ordinary image-header reply-button message.
- Native payload follows Meta's current media-carousel reference, including card type `cta_url` and `quick_reply` actions. Do not silently change it to a guessed button-card payload. A real sender test must confirm current-account compatibility.
- AI endpoint adds optional `menuAdvice`, optional menu descriptions, and optional `recommendations` IDs. Advice-mode outputs cannot set confirmed=true; non-order advice outputs have no draft. Existing callers that omit these fields remain compatible.
- Existing `Conversation.menuSession` retains a single action namespace shared by card Details and batch navigation; details do not invalidate the carousel. Adds view/page/advice-offer metadata. Stale/foreign selections cannot reference arbitrary tenant items.
- New MongoDB collection/model `WhatsAppMenuMedia` caches Meta media IDs by a hash including business, sender number, item, locale, card design/content and currency. Cache references expire after 24 hours; price/name changes get fresh uploads. Runtime uses the existing `/internal/whatsapp/media` uploader. At most two cards are prepared concurrently.
- Authorized read-only `GET /api/v1/businesses/<businessId>/ai/menu-preview?locale=ar&page=0&branch=<optional>` returns a rendered batch with data-URL PNGs. It does not upload media, send or mutate an order.
- `next.config.ts` marks `@resvg/resvg-js` as a server external. The runtime needs its platform-specific native package and `public/fonts/noto-sans-arabic-regular.ttf`, both included by the normal dependency/build setup. Font license is bundled alongside it.

## Verify locally

```sh
# apps/admin
npm run db:generate
npm run build
RUN_DB_TESTS=true npm test -- --run tests/menu-interactive.test.ts tests/menu-carousel.test.ts tests/menu-card-image.test.ts tests/menu-presentation.test.ts tests/ai.test.ts tests/orders.test.ts tests/reply.test.ts tests/inbound.test.ts tests/open-hours.test.ts tests/branch-location.test.ts

# Export a read-only sample (no WhatsApp or Meta uploads)
node --env-file=.env --import tsx scripts/export-menu-carousel.ts BUSINESS_ID OUTPUT_DIRECTORY

# companion lumia-order-api
npm run typecheck
npm test
```

Tests cover pagination across all 35 items, 0/1/2-item menus, Arabic/emoji handling, actual PNG rendering, three-decimal currencies, dialect triggers, ordinary greetings, Details without cart mutation, shared card/navigation session IDs, advice acceptance/decline, old yes/pending-order ambiguity, grounded prices, direct/voice ordering, COD idempotency, duplicate inbound delivery, stock changes, cache invalidation, selected-branch isolation, receiver-number isolation, closed hours and expired windows. Companion API tests verify the documented payload, one-card exception, limits, rejection behavior and advice normalization.

## Required review and live verification gate

1. Review the sample batch and follow-up wording with the user. Do not deploy this replacement before that review.
2. Recheck Burger House's connected sender and the authorized recipient's current 24-hour service window. Do not register/change phone numbers, submit templates, or enable other businesses.
3. Using the exact companion API carousel builder and tenant credentials, run a native send to the already authorized recipient only. Use generated cards uploaded via the existing media uploader; never print credentials. Record Meta's response/message ID and inspect delivery failure receipts. A mocked test or successful media upload is not proof of native carousel support.
4. If Meta rejects the format or sender, report the actual blocker and keep the new flow unreleased. Do not substitute the old lists or create a template automatically.
5. After successful native verification, deploy both updated services together during the Burger House trial and manually test a real Details reply, page navigation, yes/preference/advice, direct voice selection and COD confirmation. Confirm the real order reaches the correct dashboard/terminal once. Other businesses must retain their settings.
6. Retain current service revisions for rollback; switching this business's interactive menu setting off restores ordinary AI conversations.

Reference: https://developers.facebook.com/documentation/business-messaging/whatsapp/messages/interactive-media-carousel-messages (read in-browser; the web fetch endpoint returned rate-limit errors). The native sender accepted the eight-card request after review. Actual delivery and manual customer interactions remain the rollout checks.
