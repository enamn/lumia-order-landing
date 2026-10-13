import 'package:lumia_terminal/alarm/alarm.dart';
import 'package:lumia_terminal/printing/printer.dart';
import 'package:lumia_terminal/orders/order.dart';

Map<String, dynamic> snap({String id = 'o1', String status = 'AWAITING_BUSINESS_CONFIRMATION', String fulfillment = 'PICKUP', int total = 5000, String currency = 'AED'}) => {
      'orderId': id, 'number': '1002', 'status': status, 'fulfillment': fulfillment, 'createdAt': '2026-10-13T10:00:00.000Z', 'prepMinutes': null, 'promisedAt': null,
      'business': {'name': 'Grill', 'trn': null}, 'branch': {'id': 'b', 'name': 'Main', 'phone': null}, 'customer': {'name': 'Sara', 'phone': '+971501234567'},
      'address': fulfillment == 'DELIVERY' ? {'text': 'Al Majaz', 'label': 'Home', 'city': 'Sharjah', 'instructions': null, 'map': null} : null, 'note': '', 'currency': currency,
      'subtotalMinor': total, 'discountMinor': 0, 'discountCode': null, 'deliveryFeeMinor': 0, 'taxMinor': 0, 'totalMinor': total,
      'items': [{'name': 'Burger', 'variant': null, 'quantity': 2, 'unitMinor': 2500, 'totalMinor': 5000, 'notes': 'no onion', 'modifiers': [{'name': 'Cheese', 'quantity': 1, 'totalMinor': 0}]}],
    };

class FakeAlarm implements Alarm {
  bool ringing = false;
  @override
  Future<void> setRinging(bool r) async => ringing = r;
  @override
  Future<void> dispose() async {}
}

class FakePrinter implements ReceiptPrinter {
  final printed = <String>[];
  @override
  Future<PrintResult> printOrder(Order o, {required String lang}) async { printed.add(o.number); return const PrintResult.ok(); }
  @override
  Future<PrintResult> printTest({required String lang}) async => const PrintResult.ok();
}
