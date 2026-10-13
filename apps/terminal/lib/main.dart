import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'app_state.dart';
import 'background/service.dart';
import 'core/store.dart';
import 'printing/senraise_receipt_printer.dart';
import 'ui/orders_screen.dart';
import 'ui/pairing_screen.dart';
import 'ui/theme.dart';

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
        home: ListenableBuilder(listenable: app, builder: (_, _) => !app.ready ? const Scaffold() : app.paired && app.orders != null ? OrdersScreen(app: app) : Directionality(textDirection: app.ar ? TextDirection.rtl : TextDirection.ltr, child: PairingScreen(app: app))),
      );
}
