# Lumia Order terminal: design brief (splash, logo, layout)

Hand this file to Claude (Claude Design / Figma) together with the files it lists in section 9. Goal: make the terminal app look like the rest of Lumia Order (marketing site, dashboard, the mock in `apps/admin/public/brand/terminal-order.png`) and be fast to use in a busy kitchen.

## 1. What the app is
* **Lumia Order terminal**: the screen of a Senraise **H10S** handheld/counter terminal that Lumia supplies to restaurants. Customers order on WhatsApp; the terminal rings, shows the order, staff **accept** (with a ready time) or **reject**, then mark it Preparing, Ready, Out for delivery, Completed. A receipt prints on the built-in printer (top of the device).
* **Users**: restaurant staff, often in a hurry, noisy and bright, one hand free, gloves or wet fingers possible. They glance at the screen: the big things must be readable from arm's length.
* **Kiosk**: the app is the only app. No browser chrome, no back button, no system navigation visible. Portrait only.
* **Languages**: English and Arabic (right-to-left). Every screen must be designed in both.
* **Money**: Gulf currencies (AED mostly). The dirham sign font `Dirham-Sans` (`apps/admin/public/fonts/dirham-sans.woff2`) is used by the dashboard; the terminal may show "AED 96" as text as in the mock.

## 2. Device facts
* Screen **720 x 1440 px, 320 dpi = 360 x 720 dp**, portrait, 18:9. Android 13. Touch only.
* Built-in thermal printer, **58 mm paper, 384 dots wide**, black and white only.
* Plan for safe areas: status bar hidden (immersive mode), 16 dp side margins, 24 dp bottom margin above the system gesture area.

## 3. Brand (use exactly these)
**Logo**: a rounded speech bubble outlined with the pink-to-violet gradient, with a black "L" and a gradient ring "o" inside. Files: `lumia-mark.svg` (vector, white background rectangle: remove it for transparent use) and `lumia-mark.png` (512 px). Wordmark in the mock: "Lumia" in semibold white/ink with "Order" in a lighter weight underneath. Keep clear space of half the bubble's width.

**Colour tokens** (from `src/styles.css`):
| Token | Value | Use |
|---|---|---|
| ink | `#1A0815` | main text, dark surfaces |
| ink-2 | `#3D1C31` | secondary text |
| muted | `#8A5A6E` | captions, labels |
| pink | `#FF5577` | gradient start |
| violet | `#C93DFF` | gradient end |
| grad | `linear-gradient(90deg, #FF5577, #C93DFF)` | headers, primary buttons (135 deg for icons/large areas) |
| soft | `linear-gradient(135deg, #FFEEF2, #FCE8F5, #F1E6FF)` | splash / empty-state backgrounds |
| tint | `#FBF3F8` / `#FAF6FA` | screen background |
| line | `#ECD9E0`, `#E3CBD4`, `#F0E4E8` | borders, dividers |
| ok / ok-bg | `#16704A` / `#E4F4EC` | success, Online, Completed |
| error | `#B42318` | reject, errors |

**Status chips** (same as the dashboard): New `#FDEAF2` on `#8A2040`; Preparing `#FFF1DC` on `#8A4B00`; Ready `#F1E6FF` on `#6A1FA0`; On the way `#F6EEF2` on `#3D1C31`; Completed `#E6F4EC` on `#16704A`; Rejected/Cancelled `#B42318`.

**Type**: Geist (Latin) and IBM Plex Sans Arabic (Arabic); numbers in Geist semibold; order numbers may use JetBrains Mono. Headings tight (letter-spacing about -2%). Rounded corners: 14 dp cards, 12 dp buttons, full pill for chips.

**Feel**: friendly, clean, soft pink tints on white. The gradient is the accent: use it only for the header of a new order, the primary action (Accept) and the logo. Everything else is white, ink and soft lines.

**Today's app (to be restyled)**: it uses a placeholder maroon `#8A2040` for buttons and chips. Replace it with the gradient and tokens above.

## 4. Deliverables

### 4.1 App icon (launcher)
* Android **adaptive icon**: foreground = the bubble logo centred inside the 66% safe zone of a 108 dp canvas; background = white or the soft gradient; plus a **monochrome** layer (for themed icons). Export `ic_launcher_foreground`, `ic_launcher_background`, `ic_launcher_monochrome` and a 512 px Play-style preview.
* **Notification small icon** (status bar of the always-on service): white single-colour bubble silhouette, 24 dp, transparent.

### 4.2 Splash screen
* **System splash (Android 12+ API)**: centred logo on white or `soft`, no text, 288 dp icon area. Must look right on a 720 x 1440 screen; no Flutter logo, no white flash.
* **In-app splash / loading** (shown while the app connects, about 1 s): logo with a subtle gradient shimmer or fade-in, wordmark "Lumia Order" beneath, a thin gradient progress bar at the bottom. Under 1.2 s, no long animation, because staff restart the terminal often. Include an offline variant ("Connecting...").
* Both in Arabic layout too (wordmark and text mirrored where it is text; the logo itself is never mirrored).

### 4.3 Screens (design each at 360 x 720 dp, English and Arabic RTL)
1. **Connect this terminal** (first run): logo, short instruction, **Scan QR code** primary button, 6-digit code field, Connect, language switch, error state ("code wrong or expired").
2. **Orders** (main): top bar with branch name and an Online/Offline dot; tab chips New / Preparing / Ready / On the way / Done with counts; order cards (number, type chip, items summary, total, customer, minutes ago, promised time); empty state per tab; error banner.
3. **New order alert (full screen, most important)**: follow the mock `terminal-order.png`: gradient header "NEW ORDER" with "now", order number, **very large total**, "Customer confirmed on WhatsApp", scrollable items with options and notes, customer note highlighted, delivery address; **Reject** (white, outlined) and **Accept** (gradient) pinned at the bottom, Accept twice as wide. A counter badge when several orders wait ("3"). Must be readable from 1 metre: total at least 40 sp, order number at least 28 sp.
4. **Accept time sheet**: "Ready in" / "Delivery in" with chips 10, 15, 20, 30, 45, 60, a -/+ 5 minute stepper (large), and a brand-gradient confirm button.
5. **Reject reasons sheet**: four large buttons (Sold out, Too busy, Closing soon, Outside delivery area).
6. **Order detail**: items with options, customer, address, promised time, totals (subtotal, discount, delivery fee, total), a Print button, and one big next-step button pinned at the bottom (Mark ready / Out for delivery / Completed).
7. **Settings sheet**: alarm sound, print on accept, language, disconnect (destructive, with confirm).
8. **States**: offline banner, "printing..." / "could not print, tap to retry", "order already handled on the dashboard", loading skeletons.

### 4.4 Receipt (58 mm, 384 dots, black and white only)
Redesign the printed receipt layout: mono version of the logo at the top (about 120 px wide, 1-bit), business name, branch, order number very large, type (DELIVERY / PICKUP) large, time and promised time, customer and address, items with options indented, totals with TOTAL largest, "Thank you!" footer, and a QR code (delivery map link) when present. Specify exact font sizes and weights; the app draws it as a picture (`apps/terminal/lib/printing/receipt_image.dart`), so any layout is possible. Arabic version mirrored.

## 5. Interaction and usability rules
* Touch targets at least **56 dp** high; primary buttons 64 dp. Spacing 12-16 dp between actions.
* Primary actions at the **bottom** (one-hand reach). Accept and Reject are never inside a scrolling area.
* Contrast at least 7:1 for key text (kitchen glare). No light grey on white for anything that matters.
* Text: body at least 16 sp, labels at least 14 sp, key numbers at least 24 sp.
* Do not rely on colour alone (chips carry words; Online carries text).
* No hover, no tiny icons without labels, no swipe-only actions.
* Alarm state: while a new order waits, the screen must be unmistakable (header gradient, large type); no flashing faster than 3 Hz.
* Motion: short (150-250 ms), nothing that delays tapping.

## 6. Layout system
8 dp grid; 16 dp screen margins; card padding 14-16 dp; 8 dp between chips; bottom action area 16 dp padding plus safe area. Specify heights for the top bar (56 dp), tab row (48 dp), cards (auto), bottom bar (88 dp).

## 7. Output format wanted
1. A Figma file (or an HTML/PNG mock-up set) with all screens in section 4.3 in EN and AR, plus the icon and splash artboards and the receipt at 384 px wide at 2x.
2. Exported assets: SVG/PNG for the icon layers, notification icon, splash logo, a 1-bit receipt logo.
3. A short **token sheet** in Flutter terms: colours, text styles (size, weight, height), radii, spacing, ready to paste into `apps/terminal/lib/ui/theme.dart`.

## 8. Implementation notes for the developer (Claude Code)
* The Flutter app is `apps/terminal` (package `ae.lumia.lumia_terminal`). UI files: `lib/ui/theme.dart` (tokens, currently maroon), `pairing_screen.dart`, `orders_screen.dart`, `incoming.dart` (new-order alert), `time_sheet.dart`, `order_detail.dart`, `settings_sheet.dart`; strings in `lib/ui/strings.dart` (EN/AR); receipt in `lib/printing/receipt_image.dart`.
* Icons/splash: use `flutter_launcher_icons` and `flutter_native_splash` (or hand-written Android resources in `android/app/src/main/res`); keep the notification icon in `res/drawable`.
* Add Geist and IBM Plex Sans Arabic as bundled fonts (offline; the terminal may have no internet at first start).
* Test on the real unit over ADB (`adb exec-out screencap -p`), both languages, and keep `flutter test` and `flutter analyze` green.

## 9. Files to give Claude
`apps/admin/public/brand/lumia-mark.svg`, `lumia-mark.png`, `terminal-order.png`, `terminal.png`; `src/styles.css` (tokens); `apps/admin/public/fonts/dirham-sans.woff2`; `apps/terminal/lib/ui/*.dart`; `apps/terminal/lib/printing/receipt_image.dart`; `apps/terminal/TERMINAL_SETUP.md`; `TERMINAL_PROTOCOL.md` (order fields shown on screen).

## 10. Acceptance checklist
- [ ] Icon and splash use the Lumia bubble, no Flutter logo anywhere
- [ ] New-order alert matches the marketing mock and is readable at 1 m
- [ ] Gradient used only for logo, header of a new order and the Accept button
- [ ] All screens exist in English and Arabic RTL
- [ ] Touch targets 56 dp or more, key text contrast 7:1 or more
- [ ] Receipt prints crisp on 58 mm paper in both languages
- [ ] Verified on the H10S (720 x 1440): nothing cut off, no scrolling needed for Accept/Reject
