import 'dart:async';
import 'dart:math';
import 'package:android_id/android_id.dart';
import 'package:device_info_plus/device_info_plus.dart';
import 'package:flutter/widgets.dart';
import 'package:wakelock_plus/wakelock_plus.dart';
import 'alarm/alarm.dart';
import 'background/service.dart';
import 'core/api.dart';
import 'core/config.dart';
import 'core/realtime.dart';
import 'core/store.dart';
import 'orders/order.dart';
import 'orders/orders_controller.dart';
import 'printing/printer.dart';

// Ties the pieces together: the saved pairing, the live connection, the orders, the alarm and the printer.
class AppState extends ChangeNotifier with WidgetsBindingObserver {
  AppState(this.store, {Alarm? alarm, ReceiptPrinter? printer}) : alarm = alarm ?? SoundAlarm(), printer = printer ?? NoPrinter();
  final Store store;
  final Alarm alarm;
  final ReceiptPrinter printer;

  Session? session;
  OrdersController? orders;
  Realtime? _rt;
  bool online = false, ready = false;
  String lang = 'en';
  String? pairError;
  bool pairing = false;

  bool get paired => session != null;
  bool get ar => lang == 'ar';

  Future<void> init() async {
    lang = store.lang;
    WidgetsBinding.instance.addObserver(this);
    WakelockPlus.enable(); // the screen stays on: this is the order screen
    session = await store.loadSession();
    if (session != null) _connect(session!);
    ready = true;
    notifyListeners();
  }

  bool _asked = false;

  // The notification of the always-on service doubles as a status line.
  void _status() {
    final n = orders?.fresh.length ?? 0;
    Background.update(title: 'Lumia Order · ${session?.branch ?? ''}', text: n > 0 ? (ar ? '$n طلب جديد بانتظارك' : '$n new order${n == 1 ? '' : 's'} waiting') : (online ? (ar ? 'متصل: جاهز لاستقبال الطلبات' : 'Connected: ready for orders') : (ar ? 'غير متصل: جارٍ إعادة الاتصال' : 'Offline: reconnecting')));
  }

  Future<void> _startBackground() async {
    await Background.start(title: 'Lumia Order · ${session?.branch ?? ''}', text: ar ? 'جارٍ الاتصال…' : 'Connecting…');
    if (!_asked) { _asked = true; await Background.askPermissions(); await Background.start(title: 'Lumia Order · ${session?.branch ?? ''}', text: ar ? 'جارٍ الاتصال…' : 'Connecting…'); }
  }

  void _connect(Session s) {
    _startBackground();
    final api = Api(base: s.api.isEmpty ? defaultApp : s.api, key: s.key);
    final c = OrdersController(api: api, alarm: alarm, printer: printer, lang: () => lang, autoPrint: () => store.autoPrint, alarmOn: () => store.alarmOn);
    c.addListener(() { notifyListeners(); _status(); });
    orders = c;
    _rt = Realtime(
      url: s.realtime, key: s.key, version: appVersion, since: store.lastEvent, saveSince: store.setLastEvent,
      onState: (v) { online = v; if (v) c.load(); notifyListeners(); _status(); }, // catch up each time we (re)connect
      onRevoked: _revoked, onEvent: _onEvent)..start();
  }

  Future<void> _onEvent(String id, String event, Map<String, dynamic> p, int at) async {
    orders?.onEvent(event, p);
    if (event == 'device.revoked') { await _revoked(); }
    if (event == 'print.test') {
      final r = await printer.printTest(lang: lang);
      _rt?.send({'type': 'print.result', 'ok': r.ok, if (r.reason != null) 'reason': r.reason});
    }
    if (event == 'print.order') {
      final r = await printer.printOrder(Order.fromJson(p), lang: lang);
      _rt?.send({'type': 'print.result', 'ok': r.ok, if (r.reason != null) 'reason': r.reason, 'jobId': p['jobId'], 'orderId': p['orderId']});
    }
  }

  // The restaurant disconnected this terminal: forget the key and show the connect screen.
  Future<void> _revoked() async {
    _rt?.stop(); _rt = null; orders?.clear(); orders = null; online = false; await Background.stop();
    await store.forget(); session = null; notifyListeners();
  }

  // The terminal's identity in the dashboard. Android's own device id survives uninstalling and reinstalling the app (for the same signing key; it changes
  // only on a factory reset), so a reinstalled terminal is the same device. (Keystore storage would not help: Android erases it with the app.)
  Future<String> _serial() async {
    var s = store.serial;
    if (s != null && s.startsWith('AID-')) return s;
    String? id;
    try { id = await const AndroidId().getId(); } catch (_) {}
    if (id != null && id.length >= 8) { s = 'AID-$id'; }
    else {
      s ??= () { final r = Random.secure(); return 'LT-${List.generate(16, (_) => r.nextInt(36).toRadixString(36)).join()}'; }(); // last resort: a random one, kept
    }
    await store.setSerial(s);
    return s;
  }

  Future<String> _model() async {
    try { return (await DeviceInfoPlugin().androidInfo).model; } catch (_) { return 'Lumia terminal'; }
  }

  // The 6 digits typed, or read from the QR code (lumia-pair://v1?c=482913&h=https%3A%2F%2F...).
  Future<void> pair(String input) async {
    var code = input.replaceAll(RegExp(r'\D'), ''), base = defaultApp;
    final uri = Uri.tryParse(input.trim());
    if (uri != null && uri.scheme == 'lumia-pair') { code = uri.queryParameters['c'] ?? ''; base = uri.queryParameters['h'] ?? defaultApp; }
    if (code.length != 6) { pairError = ar ? 'أدخل الرمز المكوّن من 6 أرقام.' : 'Enter the 6-digit code.'; notifyListeners(); return; }
    pairing = true; pairError = null; notifyListeners();
    try {
      final p = await Api(base: base).pair(code: code, serial: await _serial(), model: await _model());
      final s = Session(key: p.key, deviceId: p.deviceId, business: p.business, branch: p.branch, realtime: p.realtime, api: p.api);
      await store.saveSession(s); await store.setLastEvent(0);
      session = s; _connect(s);
    } on ApiError catch (e) {
      pairError = switch (e.code) {
        'INVALID_CODE' => ar ? 'الرمز غير صحيح أو منتهي. أنشئ رمزاً جديداً من لوحة التحكم.' : 'That code is wrong or expired. Create a new one in the dashboard.',
        'DEVICE_IN_USE' => ar ? 'هذا الجهاز متصل بمطعم آخر.' : 'This terminal is connected to another restaurant.',
        'TOO_MANY_ATTEMPTS' => ar ? 'محاولات كثيرة. انتظر قليلاً.' : 'Too many tries. Wait a few minutes.',
        _ => e.message,
      };
    }
    pairing = false; notifyListeners();
  }

  Future<void> setLang(String v) async { lang = v; await store.setLang(v); notifyListeners(); }
  Future<void> setAutoPrint(bool v) async { await store.setAutoPrint(v); notifyListeners(); }
  Future<void> setAlarmOn(bool v) async { await store.setAlarmOn(v); orders?.refreshAlarm(); notifyListeners(); }

  Future<void> unpair() async => _revoked();

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    if (state == AppLifecycleState.resumed) { _rt?.reconnectNow(); orders?.load(); }
  }
}
