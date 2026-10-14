import 'package:lumia_terminal/alarm/alarm.dart';
import 'package:lumia_terminal/app_state.dart';
import 'package:lumia_terminal/core/api.dart';
import 'package:lumia_terminal/core/store.dart';
import 'package:lumia_terminal/orders/orders_controller.dart';
import 'package:lumia_terminal/printing/printer.dart';

// Sample orders for the screen layout tests only (not part of the app).

Map<String, dynamic> _snap(String id, String number, String status, String type, String name, int total, List<List<Object?>> items,
        {int minAgo = 4, int? prep, String note = '', int fee = 0, int discount = 0}) =>
    {
      'orderId': id, 'number': number, 'status': status, 'fulfillment': type, 'createdAt': DateTime.now().subtract(Duration(minutes: minAgo)).toUtc().toIso8601String(),
      'prepMinutes': prep, 'promisedAt': prep == null ? null : DateTime.now().add(Duration(minutes: prep - minAgo)).toUtc().toIso8601String(),
      'business': {'name': 'Burger House', 'trn': null}, 'branch': {'id': 'b', 'name': 'Al Majaz', 'phone': null}, 'customer': {'name': name, 'phone': '+971 50 123 4567'},
      'address': type == 'DELIVERY' ? {'text': 'Al Majaz 2, Building 14, Flat 302, Sharjah', 'label': null, 'city': null, 'instructions': null, 'map': null} : null,
      'note': note, 'currency': 'AED', 'subtotalMinor': total - fee + discount, 'discountMinor': discount, 'discountCode': discount > 0 ? 'LUMIA10' : null, 'deliveryFeeMinor': fee, 'taxMinor': 0, 'totalMinor': total,
      'items': [for (final i in items) {'name': i[0], 'variant': null, 'quantity': i[1], 'unitMinor': i[2], 'totalMinor': (i[1] as int) * (i[2] as int), 'notes': i[3] ?? '', 'modifiers': <Map<String, Object?>>[]}],
    };

class _Silent implements Alarm {
  @override
  Future<void> setRinging(bool r) async {}
  @override
  Future<void> dispose() async {}
}

class _NoPrint implements ReceiptPrinter {
  @override
  Future<PrintResult> printOrder(order, {required String lang}) async => const PrintResult.ok();
  @override
  Future<PrintResult> printTest({required String lang}) async => const PrintResult.ok();
}

void seedDemo(AppState app, String mode) {
  if (mode == 'connect') return;
  app.session = Session(key: 'demo', deviceId: 'd', business: 'Burger House', branch: 'Al Majaz', realtime: '', api: '');
  final c = OrdersController(api: Api(base: 'http://demo.invalid'), alarm: _Silent(), printer: _NoPrint(), lang: () => app.lang, autoPrint: () => false, alarmOn: () => false);
  final kitchen = [
    _snap('o47', '1047', 'PREPARING', 'PICKUP', 'Fatima', 5400, [['Beef Burger', 1, 3600, ''], ['Onion Rings', 1, 1800, '']], minAgo: 4, prep: 12),
    _snap('o46', '1046', 'PREPARING', 'DELIVERY', 'Omar', 12800, [['Classic Burger', 3, 2800, ''], ['Fries', 3, 1200, ''], ['Water', 1, 800, '']], minAgo: 9, prep: 31, fee: 1000),
    _snap('o45', '1045', 'PREPARING', 'DELIVERY', 'Layla', 7100, [['Chicken Wrap', 2, 2500, ''], ['Coca-Cola', 2, 1050, '']], minAgo: 15, prep: 20, fee: 1000),
    _snap('o44', '1044', 'PREPARING', 'PICKUP', 'Yousef', 3900, [['Kids Meal', 1, 2400, ''], ['Milkshake', 1, 1500, '']], minAgo: 18, prep: 15),
  ];
  for (final s in kitchen) { c.onEvent('order.new', s); }
  c.onEvent('order.new', _snap('o43', '1043', 'OUT_FOR_DELIVERY', 'DELIVERY', 'Sara', 6400, [['Chicken Burger', 2, 2800, '']], minAgo: 40, prep: 20, fee: 800));
  if (mode == 'alert') {
    c.onEvent('order.new', _snap('o48', '1048', 'AWAITING_BUSINESS_CONFIRMATION', 'DELIVERY', 'Samer', 8800, [['Chicken Burger', 2, 2800, 'No onion · Extra cheese'], ['Fries, large', 1, 1800, ''], ['Coca-Cola', 2, 600, '']],
        minAgo: 3, note: "Call when you arrive. Please don't ring the bell.", fee: 1000, discount: 800));
    c.onEvent('order.new', _snap('o49', '1049', 'AWAITING_BUSINESS_CONFIRMATION', 'PICKUP', 'Noor', 3000, [['Classic Burger', 1, 3000, '']], minAgo: 1));
    c.onEvent('order.new', _snap('o50', '1050', 'AWAITING_BUSINESS_CONFIRMATION', 'PICKUP', 'Khalid', 2800, [['Classic Burger', 1, 2800, '']], minAgo: 0));
  }
  c.loaded = true;
  app.orders = c;
  app.online = true;
}
