import 'package:flutter/material.dart';
import 'package:mobile_scanner/mobile_scanner.dart';
import '../app_state.dart';
import 'strings.dart';
import 'theme.dart';

class PairingScreen extends StatefulWidget {
  const PairingScreen({super.key, required this.app});
  final AppState app;
  @override
  State<PairingScreen> createState() => _PairingScreenState();
}

class _PairingScreenState extends State<PairingScreen> {
  final _code = TextEditingController();
  bool _scanning = false;

  @override
  Widget build(BuildContext context) {
    final app = widget.app, l = app.lang;
    return Scaffold(
      body: SafeArea(
        child: _scanning
            ? Stack(children: [
                MobileScanner(onDetect: (cap) {
                  final v = cap.barcodes.map((b) => b.rawValue).whereType<String>().firstWhere((v) => v.startsWith('lumia-pair://'), orElse: () => '');
                  if (v.isNotEmpty) { setState(() => _scanning = false); app.pair(v); }
                }),
                Positioned(left: 16, right: 16, bottom: 16, child: OutlinedButton(style: OutlinedButton.styleFrom(backgroundColor: Colors.white), onPressed: () => setState(() => _scanning = false), child: Text(tr(l, 'cancel')))),
              ])
            : ListView(padding: const EdgeInsets.all(24), children: [
                const SizedBox(height: 24),
                Row(children: [Container(width: 44, height: 44, decoration: BoxDecoration(gradient: const LinearGradient(colors: [brand, purple]), borderRadius: BorderRadius.circular(12)), child: const Icon(Icons.receipt_long, color: Colors.white)), const SizedBox(width: 12), const Text('Lumia Order', style: TextStyle(fontSize: 24, fontWeight: FontWeight.w800))]),
                const SizedBox(height: 28),
                Text(tr(l, 'connect'), style: const TextStyle(fontSize: 24, fontWeight: FontWeight.w800)),
                const SizedBox(height: 8),
                Text(tr(l, 'connectHelp'), style: const TextStyle(fontSize: 15, height: 1.4)),
                const SizedBox(height: 24),
                FilledButton.icon(onPressed: app.pairing ? null : () => setState(() => _scanning = true), icon: const Icon(Icons.qr_code_scanner), label: Text(tr(l, 'scan'))),
                const SizedBox(height: 20),
                TextField(
                  controller: _code, keyboardType: TextInputType.number, maxLength: 7, textAlign: TextAlign.center, style: const TextStyle(fontSize: 30, letterSpacing: 6, fontWeight: FontWeight.w700),
                  decoration: InputDecoration(hintText: '000 000', labelText: tr(l, 'code'), border: OutlineInputBorder(borderRadius: BorderRadius.circular(12)), counterText: ''),
                  onSubmitted: app.pair,
                ),
                if (app.pairError != null) Padding(padding: const EdgeInsets.only(top: 8), child: Text(app.pairError!, style: const TextStyle(color: Color(0xFFB42318), fontSize: 15))),
                const SizedBox(height: 12),
                OutlinedButton(onPressed: app.pairing ? null : () => app.pair(_code.text), child: app.pairing ? const SizedBox(height: 22, width: 22, child: CircularProgressIndicator(strokeWidth: 3)) : Text(tr(l, 'connectBtn'))),
                const SizedBox(height: 24),
                Align(child: TextButton(onPressed: () => app.setLang(app.ar ? 'en' : 'ar'), child: Text(app.ar ? 'English' : 'العربية'))),
              ]),
      ),
    );
  }
}
