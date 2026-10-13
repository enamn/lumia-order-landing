import 'dart:io';
import 'dart:ui' as ui;
import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:lumia_terminal/orders/order.dart';
import 'package:lumia_terminal/printing/receipt_image.dart';
import 'package:lumia_terminal/printing/senraise_receipt_printer.dart';
import 'support.dart';

Future<void> loadRoboto() async {
  // Tests draw text with a placeholder font; load a real one so a saved receipt can be looked at.
  final f = File('${Platform.environment['FLUTTER_ROOT'] ?? '/Users/ahmad/flutter'}/bin/cache/artifacts/material_fonts/Roboto-Regular.ttf');
  if (!f.existsSync()) return;
  final loader = FontLoader('Roboto')..addFont(Future.value(ByteData.sublistView(f.readAsBytesSync())));
  await loader.load();
  receiptFontFamily = 'Roboto';
}

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  testWidgets('the receipt is a 384-dot wide picture, taller with more items', (tester) async {
    await tester.runAsync(() async {
      await loadRoboto();
      final one = Order.fromJson(snap(fulfillment: 'DELIVERY'));
      final big = Map<String, dynamic>.from(snap(fulfillment: 'DELIVERY'))..['items'] = List.generate(8, (i) => {'name': 'Dish $i', 'variant': null, 'quantity': 1, 'unitMinor': 1000, 'totalMinor': 1000, 'notes': '', 'modifiers': []});
      Future<(int, int)> size(Order o, String lang) async { final png = await renderReceipt(o, lang: lang); final c = await (await ui.instantiateImageCodec(png)).getNextFrame().then((f) => f.image); return (c.width, c.height); }
      final a = await size(one, 'en'), b = await size(Order.fromJson(big), 'en'), ar = await size(one, 'ar');
      expect(a.$1, 384); expect(ar.$1, 384); expect(b.$2, greaterThan(a.$2)); expect(a.$2, greaterThan(300));
      final out = Platform.environment['RECEIPT_PNG'];
      if (out != null) { File(out).writeAsBytesSync(await renderReceipt(one, lang: 'en')); }
    });
  });

  group('printing through the Senraise service', () {
    const channel = MethodChannel('senraise_printer');
    List<Map<Object?, Object?>>? ops;
    tearDown(() => TestDefaultBinaryMessengerBinding.instance.defaultBinaryMessenger.setMockMethodCallHandler(channel, null));
    void service(Future<Object?> Function(MethodCall) h) => TestDefaultBinaryMessengerBinding.instance.defaultBinaryMessenger.setMockMethodCallHandler(channel, h);

    testWidgets('sends the receipt picture, a map QR for delivery, and paper feed in one job', (tester) async {
      service((c) async { ops = ((c.arguments as Map)['ops'] as List).cast<Map<Object?, Object?>>(); return null; });
      await tester.runAsync(() async {
        final r = await SenraiseReceiptPrinter().printOrder(Order.fromJson(snap(fulfillment: 'DELIVERY')..['address'] = {'text': 'x', 'label': null, 'city': null, 'instructions': null, 'map': 'https://maps.google.com/?q=1,2'}), lang: 'en');
        expect(r.ok, true);
      });
      expect(ops!.map((o) => o['op']), ['align', 'pic', 'qr', 'line', 'line']);
      expect((ops![1]['data'] as Uint8List).length, greaterThan(500));
    });

    testWidgets('reports OFFLINE when the printing service is not available, OTHER for other failures', (tester) async {
      await tester.runAsync(() async {
        service((c) async => throw PlatformException(code: 'NOT_BOUND', message: 'no service'));
        expect((await SenraiseReceiptPrinter().printTest(lang: 'en')).reason, 'OFFLINE');
        service((c) async => throw PlatformException(code: 'PRINT_FAILED', message: 'boom'));
        final r = await SenraiseReceiptPrinter().printTest(lang: 'ar');
        expect(r.ok, false); expect(r.reason, 'OTHER');
      });
    });
  });
}
