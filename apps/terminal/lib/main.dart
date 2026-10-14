import 'dart:async';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'app_state.dart';
import 'background/service.dart';
import 'core/store.dart';
import 'printing/senraise_receipt_printer.dart';
import 'ui/icons.dart';
import 'ui/orders_screen.dart';
import 'ui/pairing_screen.dart';
import 'ui/splash_screen.dart';
import 'ui/strings.dart';
import 'ui/theme.dart';
import 'ui/widgets.dart';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();
  Background.init();
  SystemChrome.setEnabledSystemUIMode(SystemUiMode.immersiveSticky); // the order screen owns the whole display
  final app = AppState(await Store.open(), printer: SenraiseReceiptPrinter());
  await app.init();
  runApp(LumiaTerminal(app: app));
}

class LumiaTerminal extends StatelessWidget {
  const LumiaTerminal({super.key, required this.app});
  final AppState app;
  @override
  Widget build(BuildContext context) => MaterialApp(
        title: 'Lumia Order', debugShowCheckedModeBanner: false, theme: appTheme(),
        builder: (context, child) => Stack(children: [child!, HandledOverlay(app: app)]),
        home: Root(app: app),
      );
}

// Splash first (about 1.1 s). A paired terminal that is not online yet keeps showing "Connecting..." for a few seconds, then the orders screen
// takes over with its own offline banner.
class Root extends StatefulWidget {
  const Root({super.key, required this.app});
  final AppState app;
  @override
  State<Root> createState() => _RootState();
}

class _RootState extends State<Root> {
  bool _minShown = false, _gaveUp = false;
  Timer? _a, _b;
  @override
  void initState() {
    super.initState();
    _a = Timer(const Duration(milliseconds: 1100), () { if (mounted) setState(() => _minShown = true); });
    _b = Timer(const Duration(seconds: 7), () { if (mounted) setState(() => _gaveUp = true); });
  }

  @override
  void dispose() { _a?.cancel(); _b?.cancel(); super.dispose(); }

  @override
  Widget build(BuildContext context) => ListenableBuilder(listenable: widget.app, builder: (_, _) {
        final app = widget.app;
        if (!app.ready || !_minShown) return SplashScreen(lang: app.lang);
        if (app.paired && app.orders != null) return app.online || _gaveUp ? OrdersScreen(app: app) : SplashScreen(lang: app.lang, offline: true);
        return PairingScreen(app: app);
      });
}

// "Already handled": shown once when an order was decided on the dashboard first. Drawn over everything, including the new-order alert.
class HandledOverlay extends StatelessWidget {
  const HandledOverlay({super.key, required this.app});
  final AppState app;
  @override
  Widget build(BuildContext context) => ListenableBuilder(listenable: app, builder: (_, _) {
        final n = app.orders?.handled, l = app.lang;
        if (n == null) return const SizedBox.shrink();
        return Directionality(
          textDirection: app.ar ? TextDirection.rtl : TextDirection.ltr,
          child: Material(
            color: scrim,
            child: Center(child: Padding(padding: const EdgeInsets.all(24), child: Container(
              padding: const EdgeInsets.fromLTRB(20, 24, 20, 20), decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(20)),
              child: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.stretch, children: [
                Center(child: Container(width: 64, height: 64, decoration: const BoxDecoration(color: okBg, shape: BoxShape.circle), child: const Center(child: Ic('check', size: 30, color: okFg, stroke: 2.2)))),
                const SizedBox(height: 16),
                Text(tr(l, 'handledTitle'), style: ts(22, w: 600, ls: -0.02), textAlign: TextAlign.center),
                const SizedBox(height: 6),
                Text(trv(l, 'handledBody', {'n': n}), style: ts(16, color: ink2, h: 1.5), textAlign: TextAlign.center),
                const SizedBox(height: 20),
                GradButton(label: tr(l, 'ok'), height: 56, size: 17, onTap: app.orders!.clearHandled),
              ]),
            ))),
          ),
        );
      });
}
