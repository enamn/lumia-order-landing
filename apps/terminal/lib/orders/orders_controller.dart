import 'package:flutter/foundation.dart';
import '../alarm/alarm.dart';
import '../core/api.dart';
import '../printing/printer.dart';
import 'order.dart';

// The orders on this terminal: filled by the live connection, changed by staff, and kept in step with the dashboard (first to decide wins).
class OrdersController extends ChangeNotifier {
  OrdersController({required this.api, required this.alarm, required this.printer, required this.lang, required this.autoPrint, required this.alarmOn});
  Api api;
  final Alarm alarm;
  final ReceiptPrinter printer;
  String Function() lang;
  bool Function() autoPrint, alarmOn;

  final Map<String, Order> _orders = {};
  final List<Order> recent = []; // finished orders, newest first, this session only
  String? error;
  bool busy = false, loaded = false; // loaded: the first list has arrived (until then the screen shows a skeleton)
  String? handled; // number of an order that was already decided on the dashboard: the screen tells staff once
  void clearHandled() { handled = null; notifyListeners(); }

  List<Order> get open => _orders.values.toList()..sort((a, b) => a.createdAt.compareTo(b.createdAt));
  List<Order> inStage(Stage s) => open.where((o) => o.stage == s).toList();
  List<Order> get fresh => inStage(Stage.fresh);

  void _upsert(Map<String, dynamic> snap) {
    final o = Order.fromJson(snap);
    if (o.stage == Stage.done) {
      _orders.remove(o.id);
      recent.removeWhere((r) => r.id == o.id); recent.insert(0, o); if (recent.length > 30) recent.removeLast();
    } else {
      _orders[o.id] = o;
    }
  }

  void _sync() { alarm.setRinging(alarmOn() && fresh.isNotEmpty); notifyListeners(); }
  void refreshAlarm() => _sync();

  // From the live connection.
  void onEvent(String event, Map<String, dynamic> payload) {
    if (event == 'order.new' || event == 'order.updated') { _upsert(payload); _sync(); }
  }

  // After connecting or coming back: the open orders of this branch as the server has them.
  Future<void> load() async {
    try {
      final list = await api.openOrders();
      final ids = list.map((s) => '${s['orderId']}').toSet();
      _orders.removeWhere((id, _) => !ids.contains(id)); // decided elsewhere while we were away
      for (final s in list) { _upsert(s); }
      error = null;
    } on ApiError catch (e) { error = e.message; }
    loaded = true;
    _sync();
  }

  Future<bool> _run(Future<void> Function() action, Order order) async {
    busy = true; error = null; notifyListeners();
    try { await action(); return true; }
    on ApiError catch (e) {
      final tooLate = e.code == 'INVALID_TRANSITION';
      await load(); // show how it really is now
      if (tooLate) { handled = order.number; } else { error = e.message; } // (load clears the error, so set it after)
      return false;
    } finally { busy = false; _sync(); }
  }

  // Accept with the time the customer is told. Like the dashboard, it passes through "preparing" so the kitchen can mark it ready next.
  Future<bool> accept(Order o, int minutes) async {
    final ok = await _run(() async {
      await api.setStatus(o.id, 'ACCEPTED', prepMinutes: minutes);
      await api.setStatus(o.id, 'PREPARING');
    }, o);
    if (ok && autoPrint()) { printer.printOrder(o, lang: lang()); }
    return ok;
  }

  Future<bool> reject(Order o, String reason) => _run(() => api.setStatus(o.id, 'REJECTED', reason: reason), o);

  // The next step for an order that is being prepared / is ready / is out.
  String? nextStatus(Order o) => switch (o.status) {
        'ACCEPTED' || 'PREPARING' => 'READY',
        'READY' => o.isDelivery ? 'OUT_FOR_DELIVERY' : 'COMPLETED',
        'OUT_FOR_DELIVERY' => 'COMPLETED',
        _ => null,
      };

  Future<bool> advance(Order o) {
    final next = nextStatus(o);
    if (next == null) return Future.value(false);
    return _run(() async {
      if (o.status == 'ACCEPTED') await api.setStatus(o.id, 'PREPARING');
      await api.setStatus(o.id, next);
    }, o);
  }

  Future<bool> reprint(Order o) async => (await printer.printOrder(o, lang: lang())).ok;

  void clear() { _orders.clear(); recent.clear(); alarm.setRinging(false); notifyListeners(); }
}
