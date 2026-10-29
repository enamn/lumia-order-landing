# WhatsApp message templates Lumia Order uses

Templates are created and approved in **Meta Business Manager → WhatsApp Manager → Message templates**, in the WhatsApp Business Account of each restaurant's number
(Lumia's own account for the Lumia login code). Approval usually takes minutes to a day. Until a template is approved, Lumia falls back (order review) or tells the owner
why nothing was sent (campaigns).

## 1. Order review — already created: `lumia_order_review_confirm_v1`
Sent to the customer when their order is complete. Body parameters in this order: customer name, order number (`#1007`), restaurant name, item lines, total (`145 AED`).
Quick-reply buttons **Confirm order** and **Change order** (Lumia recognises these two texts; Arabic "تأكيد الطلب" / "تعديل الطلب" also work).
Settings (API): `META_ORDER_REVIEW_TEMPLATE_NAME`, `META_ORDER_REVIEW_TEMPLATE_LANGUAGE` (default `en_US`; must equal the approved language code).

## 2. Campaign with an image — create: `lumia_campaign_offer_v1`
- **Category:** Marketing  **Language:** English, code `en` (this is how `lumia_campaign_offer_v1` was created and approved; the language code must match exactly)
- **Header:** Image (sample: any square offer picture)
- **Body** (exactly; three variables, none at the very start or end):

```
Offer from {{1}}

{{2}}

{{3}}

Reply STOP to unsubscribe. · أرسل «إيقاف» لإلغاء الاشتراك
```
- **Sample values** (Meta asks for them): `{{1}}` = `Burger House`, `{{2}}` = `Hi Sara, this weekend only: 20% off all burgers. Reply here to order.`, `{{3}}` = `Code WEEKEND20: 20% off, valid until 12 Oct.`
- **Buttons:** one **Quick reply**: `Order now`

## 3. Campaign without an image — still to create: `lumia_campaign_text_v1`
Same as above (language English `en`), **no header**. Same body, samples and the `Order now` quick-reply button.

## 4. Campaign layouts: picks carousel and priced list — to create (not sent yet)
The dashboard's campaign builder (Campaigns → layouts) previews two layouts. They are only a preview until these templates exist and are approved; today campaigns send template 2 or 3 above.

**Layout A, swipeable picks: `lumia_campaign_picks_v1`** (Marketing, English `en` and Arabic `ar` as two languages of the same name)
- **Type:** media carousel template, 2 to 10 cards. Each card: image header, body `{{1}}` (item name and price on one line, e.g. `Classic Burger · AED 35`), one Quick reply button `Order`.
- **Message body above the cards:** `Picks from {{1}}` + `{{2}}` (the owner's message) + `{{3}}` (offer line / validity) + `Reply STOP to unsubscribe. · أرسل «إيقاف» لإلغاء الاشتراك`.
- Not allowed in a variable: line breaks, so name and price share one line.

**Layout B, priced list: `lumia_campaign_list_v1`** (Marketing, `en` and `ar`)
- **Header:** image (banner). **Body** (variables never at the very start or end, no line breaks inside a variable):
```
{{1}}

{{2}}
{{3}}
{{4}}
{{5}}

Total together: {{6}}

Reply STOP to unsubscribe. · أرسل «إيقاف» لإلغاء الاشتراك
```
  `{{1}}` the owner's message, `{{2}}`..`{{5}}` one item each (`Classic Burger · AED 35`), `{{6}}` the total.
- **Buttons:** Quick reply `Order now`.
- Meta does not allow empty variables, so create one template per item count (`_2`, `_3`, `_4` items) and send the one that matches the list.

When a customer taps `Order now` or one card's `Order`, the 24-hour window opens and the assistant starts the order from those items (it never confirms for the customer).

## How Lumia fills them
- `{{1}}` the restaurant's name, `{{2}}` the message the owner wrote (`{name}` replaced by the customer's first name), `{{3}}` the offer line
  (`Code WEEKEND20: 20% off, valid until 12 Oct.`, or `Reply to this message to order.` when there is no code; Arabic when the message is Arabic).
- The image is uploaded to WhatsApp once per campaign and used as the header for every customer.
- Line breaks inside the message are sent as they are; if WhatsApp refuses them in a parameter they are sent again joined with " | ".
- A customer who replies **STOP** (or «إيقاف») is never included again; **START** («اشتراك») turns offers back on. "Cancel" is not a STOP word (it cancels an order).
- When the customer taps **Order now** (or replies), the 24-hour chat window opens and the assistant takes the order as usual; if they type the discount code, the server checks it and applies it.

## Settings (lumia-order-api environment, optional: defaults shown)
| Variable | Default |
|---|---|
| `META_CAMPAIGN_TEMPLATE_IMAGE` | `lumia_campaign_offer_v1` |
| `META_CAMPAIGN_TEMPLATE_TEXT` | `lumia_campaign_text_v1` |
| `META_CAMPAIGN_TEMPLATE_LANGUAGE` | `en` |
| `META_ORDER_REVIEW_TEMPLATE_NAME` | `lumia_order_review_confirm_v1` |
| `META_ORDER_REVIEW_TEMPLATE_LANGUAGE` | `en_US` |

## Plan allowances for campaigns
Plus: 500 offer messages a month. Pro: 3,000. Starter and the trial: none (Campaigns and Customers are Plus/Pro). Marketing messages are billed by Meta to the restaurant's own WhatsApp Business account.
