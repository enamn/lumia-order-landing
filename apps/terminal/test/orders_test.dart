import 'dart:convert';
import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:lumia_terminal/core/api.dart';
import 'package:lumia_terminal/orders/order.dart';
import 'package:lumia_terminal/orders/orders_controller.dart';
import 'support.dart';

void main() {
  test('an order snapshot is read, with its stage and money', () {
    final o = Order.fromJson(snap(fulfillment: 'DELIVERY'));
    expect(o.number, '1002'); expect(o.isNew, true); expect(o.stage, Stage.fresh); expect(o.isDelivery, true);
    expect(o.items.single.modifiers, ['Cheese']); expect(o.address, 'Home: Al Majaz');
    expect(money(5000, 'AED'), 'AED 50'); expect(money(5050, 'AED'), 'AED 50.50'); expect(money(12345, 'OMR'), 'OMR 12.345');
    expect(Order.fromJson(snap(status: 'PREPARING')).stage, Stage.kitchen); expect(Order.fromJson(snap(status: 'COMPLETED')).stage, Stage.done);
  });

  group('orders controller', () {
    late List<String> calls; late List<Map<String, dynamic>> server; late FakeAlarm alarm; late FakePrinter printer; late OrdersController c; int failNext = 0;
    setUp(() {
      calls = []; server = [snap()]; alarm = FakeAlarm(); printer = FakePrinter(); failNext = 0;
      final client = MockClient((req) async {
        if (req.method == 'GET') return http.Response(jsonEncode({'data': server}), 200);
        calls.add('${req.url.pathSegments[3]}:${jsonEncode(jsonDecode(req.body))}'); // order id : body
        if (failNext > 0) { failNext--; server = []; return http.Response(jsonEncode({'error': {'code': 'INVALID_TRANSITION', 'message': 'no'}}), 409); }
        return http.Response(jsonEncode({'data': {'id': 'o1'}}), 200);
      });
      c = OrdersController(api: Api(base: 'http://x', key: 'lumd_k', client: client), alarm: alarm, printer: printer, lang: () => 'en', autoPrint: () => true, alarmOn: () => true);
    });

    test('a new order rings the alarm until it is decided', () async {
      await c.load();
      expect(c.fresh.length, 1); expect(alarm.ringing, true);
      c.onEvent('order.updated', snap(status: 'REJECTED'));
      expect(c.fresh, isEmpty); expect(alarm.ringing, false); expect(c.recent.single.status, 'REJECTED');
      c.onEvent('order.new', snap(id: 'o2')); expect(alarm.ringing, true);
    });

    test('accepting sends the time, then preparing, and prints', () async {
      await c.load();
      expect(await c.accept(c.fresh.single, 25), true);
      expect(calls, ['o1:{"status":"ACCEPTED","prepMinutes":25}', 'o1:{"status":"PREPARING"}']);
      expect(printer.printed, ['1002']);
    });

    test('rejecting sends the reason', () async {
      await c.load();
      expect(await c.reject(c.fresh.single, 'Sold out'), true);
      expect(calls.single, 'o1:{"status":"REJECTED","reason":"Sold out"}');
    });

    test('too late (the dashboard decided first): shows it and refreshes', () async {
      await c.load(); failNext = 1;
      expect(await c.accept(c.fresh.single, 15), false);
      expect(c.handled, '1002'); expect(c.error, isNull); expect(c.open, isEmpty); expect(alarm.ringing, false); expect(printer.printed, isEmpty);
    });

    test('next steps follow the kitchen: pickup ends at completed, delivery goes out first', () {
      Order o(String s, String f) => Order.fromJson(snap(status: s, fulfillment: f));
      expect(c.nextStatus(o('PREPARING', 'PICKUP')), 'READY'); expect(c.nextStatus(o('READY', 'PICKUP')), 'COMPLETED');
      expect(c.nextStatus(o('READY', 'DELIVERY')), 'OUT_FOR_DELIVERY'); expect(c.nextStatus(o('OUT_FOR_DELIVERY', 'DELIVERY')), 'COMPLETED'); expect(c.nextStatus(o('COMPLETED', 'PICKUP')), null);
    });
  });
}
