# Setting up a Lumia Order terminal (Senraise, Android 13)

The terminal runs one app, **Lumia Order** (`apps/terminal`). It starts by itself after a reboot, stays on, rings for new orders, and cannot be closed by staff. This is done with Senraise's own portal (TMS, https://open.senraise.com), as described in the Senraise MDM manual: no custom launcher code.

## 1. Build the app (once per version)
```bash
cd apps/terminal
flutter build apk --release        # needs a release signing key (see below)
```
Release signing: create a keystore once, keep it safe (**the terminal's identity in the dashboard depends on always signing with the same key**), and reference it in `android/app/build.gradle.kts` (`signingConfigs`). Until then the build is signed with the debug key, which is fine for trying it, not for customers.

Raise the version in `pubspec.yaml` (`version: 0.1.0+1`: the number after `+` must increase with every upload).

## 2. Upload to TMS
1. TMS → **appMgr → My app → upload app**: drop the APK; fill name, icon (PNG/JPG, 144×144, under 100 KB), screenshots (3-5, 854×480). Choose **non-public** so no review is needed and only your devices see it.
2. **Application market → Application on shelves**: put it on the shelf, and enable **Automatic installation** so every connected terminal installs it.
3. New version: **UpdateApk** on the app (you can limit it to some devices first with the gray update).

## 3. Make it the screen of the terminal
1. **SystemCustom → DefaultApp → Add**: choose Lumia Order → *Set as Default*. The terminals bound to the account then open it after every start.
2. **Kiosk → Kiosk app → Modify**: enter the package name **`ae.lumia.lumia_terminal`** (the package name, not the app name) → OK. The terminal now runs only this app.
3. **Kiosk Exit Password → Change Password**: set the code staff of Lumia use to leave kiosk mode for service. Keep it out of the restaurant's hands.
4. To undo kiosk: Kiosk app → Modify → enter `*` or clear the field.
5. **DevicesMgr → MyDevices**: bind the terminals (by serial number) to the account. Remote reboot / lock is here too.

## 4. First start on the terminal
1. Open the app, allow the questions Android asks, one after another: **notifications**, **no battery restriction**, **display over other apps**, **camera** (to scan the QR code). If the unit's Android settings allow it, pre-grant them in TMS instead.
2. In the dashboard: Settings → Devices → **Connect device**; scan the QR code on the terminal (or type the 6 digits). The device shows **Online**.
3. Use **Test receipt** in the dashboard; the printer should print.
4. Place a test WhatsApp order: the terminal rings, shows the order, Accept asks for the time, the receipt prints.

## 5. Things to check on the real unit (not testable without it)
* **Arabic receipt**: print an order with Arabic names; the picture is drawn by the app, so it should be right, but check the paper width: the app draws 384 dots (58 mm). If the paper is 80 mm, tell us: it is one number (`receiptWidth` in `lib/printing/receipt_image.dart`).
* **Reboot**: after a restart the app should open by itself and show Online within a minute.
* **Screen off / sleep**: the alarm should still ring (set the unit's sleep timeout long, or never).
* **Network change**: switch Wi-Fi off/on, or SIM data: the app shows "Offline: reconnecting", then catches up and rings for what it missed.
* **Disconnect from the dashboard**: the terminal returns to the connect screen.
* **Paper out / cover open**: the printing service gives no status, so the dashboard cannot know; a receipt that does not come out must be reprinted from the order (the Print button).
