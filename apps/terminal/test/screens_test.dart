import 'dart:io';
import 'dart:ui' as ui;
import 'package:flutter/material.dart';
import 'package:flutter/rendering.dart';
import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:lumia_terminal/app_state.dart';
import 'package:lumia_terminal/core/store.dart';
import 'demo_fixture.dart';
import 'package:lumia_terminal/ui/orders_screen.dart';
import 'package:lumia_terminal/ui/order_detail.dart';
import 'package:lumia_terminal/ui/pairing_screen.dart';
import 'package:lumia_terminal/ui/settings_sheet.dart';
import 'package:lumia_terminal/ui/splash_screen.dart';
import 'package:lumia_terminal/ui/theme.dart';
import 'package:lumia_terminal/ui/time_sheet.dart';
import 'package:lumia_terminal/main.dart' show HandledOverlay;
import 'package:shared_preferences/shared_preferences.dart';
import 'support.dart';

// Every screen at the terminal's real size (360 x 720 dp = 720 x 1440 px at 2x), in English and Arabic, with the real fonts.
// A layout overflow fails the test. Set SHOTS_DIR to also save a screenshot of each screen.
Future<void> loadFonts() async {
  Future<void> load(String family, List<String> files) async {
    final l = FontLoader(family);
    for (final f in files) { l.addFont(Future.value(ByteData.sublistView(File('assets/fonts/$f').readAsBytesSync()))); }
    await l.load();
  }
  await load('Geist', ['Geist-Variable.ttf']);
  await load('IBMPlexSansArabic', ['IBMPlexSansArabic-Regular.ttf']);
}

Future<AppState> makeApp(String lang, String mode) async {
  SharedPreferences.setMockInitialValues({'lang': lang});
  final app = AppState(await Store.open(), alarm: FakeAlarm(), printer: FakePrinter());
  app.lang = lang;
  seedDemo(app, mode);
  app.ready = true;
  return app;
}

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();
  final shots = Platform.environment['SHOTS_DIR'];
  final key = GlobalKey();

  Future<void> show(WidgetTester t, Widget home, String name, {AppState? app, Future<void> Function()? after}) async {
    t.view.physicalSize = const Size(720, 1440); t.view.devicePixelRatio = 2;
    addTearDown(t.view.reset);
    await t.pumpWidget(MaterialApp(debugShowCheckedModeBanner: false, theme: appTheme(), builder: (c, child) => RepaintBoundary(key: key, child: Stack(children: [child!, if (app != null) HandledOverlay(app: app)])), home: home));
    await t.pump(const Duration(milliseconds: 400));
    if (after != null) { await after(); await t.pump(const Duration(milliseconds: 500)); }
    expect(t.takeException(), isNull, reason: name);
    if (shots != null) {
      await t.runAsync(() async {
        final b = key.currentContext!.findRenderObject() as RenderRepaintBoundary;
        final img = await b.toImage(pixelRatio: 1);
        File('$shots/$name.png').writeAsBytesSync((await img.toByteData(format: ui.ImageByteFormat.png))!.buffer.asUint8List());
      });
    }
  }

  setUpAll(() async { await loadFonts(); });

  for (final lang in ['en', 'ar']) {
    group('screens in $lang', () {
      testWidgets('connect', (t) async { final app = await makeApp(lang, 'connect'); await show(t, PairingScreen(app: app), '$lang-connect'); });
      testWidgets('splash and offline splash', (t) async {
        await show(t, SplashScreen(lang: lang), '$lang-splash');
        await show(t, SplashScreen(lang: lang, offline: true), '$lang-splash-offline');
      });
      testWidgets('orders list', (t) async { final app = await makeApp(lang, 'list'); await show(t, OrdersScreen(app: app), '$lang-orders', app: app); });
      testWidgets('new order alert', (t) async { final app = await makeApp(lang, 'alert'); await show(t, OrdersScreen(app: app), '$lang-alert', app: app); });
      testWidgets('accept time sheet', (t) async {
        final app = await makeApp(lang, 'alert');
        await show(t, OrdersScreen(app: app), '$lang-time', app: app, after: () async { pickTime(t.element(find.byType(OrdersScreen)), app, app.orders!.fresh.first); await t.pumpAndSettle(); expect(find.text(lang == 'en' ? 'Accept order' : 'قبول الطلب'), findsOneWidget); });
      });
      testWidgets('reject sheet', (t) async {
        final app = await makeApp(lang, 'alert');
        await show(t, OrdersScreen(app: app), '$lang-reject', app: app, after: () async { pickReason(t.element(find.byType(OrdersScreen)), app, app.orders!.fresh.first); await t.pumpAndSettle(); expect(find.text(lang == 'en' ? 'Sold out' : 'نفدت الكمية'), findsOneWidget); });
      });
      testWidgets('order detail', (t) async {
        final app = await makeApp(lang, 'list');
        await show(t, OrderDetail(app: app, orderId: 'o46', fallback: app.orders!.open.first), '$lang-detail', app: app);
      });
      testWidgets('settings', (t) async {
        final app = await makeApp(lang, 'list');
        await show(t, OrdersScreen(app: app), '$lang-settings', app: app, after: () async { showSettings(t.element(find.byType(OrdersScreen)), app); await t.pumpAndSettle(); expect(find.text(lang == 'en' ? 'Alarm sound' : 'صوت التنبيه'), findsOneWidget); });
      });
    });
  }
}
