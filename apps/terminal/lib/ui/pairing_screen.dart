import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:mobile_scanner/mobile_scanner.dart';
import '../app_state.dart';
import 'icons.dart';
import 'strings.dart';
import 'theme.dart';
import 'widgets.dart';

class PairingScreen extends StatefulWidget {
  const PairingScreen({super.key, required this.app});
  final AppState app;
  @override
  State<PairingScreen> createState() => _PairingScreenState();
}

class _PairingScreenState extends State<PairingScreen> {
  final _ctl = TextEditingController(), _focus = FocusNode();
  bool _scanning = false;

  @override
  void dispose() { _ctl.dispose(); _focus.dispose(); super.dispose(); }

  void _submit() { _focus.unfocus(); widget.app.pair(_ctl.text); }

  @override
  Widget build(BuildContext context) {
    final app = widget.app, l = app.lang, err = app.pairError != null;
    if (_scanning) return _scanner(l);
    return Directionality(
      textDirection: app.ar ? TextDirection.rtl : TextDirection.ltr,
      child: Scaffold(
        backgroundColor: Colors.white,
        body: SafeArea(
          child: LayoutBuilder(builder: (context, box) => SingleChildScrollView(
            child: ConstrainedBox(
              constraints: BoxConstraints(minHeight: box.maxHeight),
              child: IntrinsicHeight(
                child: Column(children: [
                  Container(height: 72, padding: const EdgeInsets.fromLTRB(16, 16, 16, 0), alignment: AlignmentDirectional.centerEnd, child: LangSwitch(lang: l, onChanged: app.setLang)),
                  Expanded(
                    child: Padding(
                      padding: const EdgeInsets.fromLTRB(20, 36, 20, 0),
                      child: Column(children: [
                        const LogoLockup(),
                        const SizedBox(height: 36),
                        Text(tr(l, 'connectTitle'), style: ts(26, w: 600, ls: -0.02), textAlign: TextAlign.center),
                        const SizedBox(height: 10),
                        Text(tr(l, 'connectSub'), style: ts(16, color: ink2, h: 1.5), textAlign: TextAlign.center),
                      ]),
                    ),
                  ),
                  Padding(
                    padding: const EdgeInsets.fromLTRB(16, 16, 16, 24),
                    child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
                      GradButton(label: tr(l, 'scan'), icon: 'scan', size: 18, onTap: app.pairing ? null : () => setState(() => _scanning = true)),
                      const SizedBox(height: 14),
                      Row(children: [
                        const Expanded(child: Divider(color: line3, thickness: 1, height: 1)),
                        Padding(padding: const EdgeInsets.symmetric(horizontal: 12), child: Text(tr(l, 'orCode'), style: ts(14, w: 400, color: muted))),
                        const Expanded(child: Divider(color: line3, thickness: 1, height: 1)),
                      ]),
                      const SizedBox(height: 14),
                      _digits(err),
                      if (err) ...[
                        const SizedBox(height: 14),
                        Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
                          Padding(padding: const EdgeInsets.only(top: 1), child: Ic('alert', size: 20, color: errFg, stroke: 1.8)), const SizedBox(width: 8),
                          Expanded(child: Text(app.pairError!, style: ts(15, color: errFg, h: 1.45))),
                        ]),
                      ],
                      const SizedBox(height: 14),
                      OutButton(label: tr(l, 'connect'), onTap: app.pairing ? null : _submit),
                    ]),
                  ),
                ]),
              ),
            ),
          )),
        ),
      ),
    );
  }

  // Six boxes the staff can see; the real input is a hidden field over them, so the number pad opens when a box is tapped.
  Widget _digits(bool err) {
    final text = _ctl.text;
    return Directionality(
      textDirection: TextDirection.ltr,
      child: Stack(alignment: Alignment.center, children: [
        Row(mainAxisAlignment: MainAxisAlignment.center, children: [
          for (var i = 0; i < 6; i++) Padding(
            padding: EdgeInsets.only(left: i == 0 ? 0 : 8),
            child: Container(
              width: 46, height: 60, alignment: Alignment.center,
              decoration: BoxDecoration(color: err ? errBg : Colors.white, borderRadius: BorderRadius.circular(12), border: Border.all(color: err ? errFg : (i == text.length && _focus.hasFocus ? pink : line2), width: 1.5)),
              child: Text(i < text.length ? text[i] : '', style: ts(26, w: 600, tabular: true)),
            ),
          ),
        ]),
        Positioned.fill(
          child: Opacity(
            opacity: 0,
            child: TextField(
              controller: _ctl, focusNode: _focus, keyboardType: TextInputType.number, maxLength: 6, autofillHints: const [AutofillHints.oneTimeCode],
              inputFormatters: [FilteringTextInputFormatter.digitsOnly], onChanged: (v) { setState(() {}); if (v.length == 6) _submit(); }, onSubmitted: (_) => _submit(),
            ),
          ),
        ),
      ]),
    );
  }

  Widget _scanner(String l) => Scaffold(
        body: Stack(children: [
          MobileScanner(onDetect: (cap) {
            final v = cap.barcodes.map((b) => b.rawValue).whereType<String>().firstWhere((v) => v.startsWith('lumia-pair://'), orElse: () => '');
            if (v.isNotEmpty) { setState(() => _scanning = false); widget.app.pair(v); }
          }),
          SafeArea(child: Align(alignment: Alignment.bottomCenter, child: Padding(padding: const EdgeInsets.all(16), child: OutButton(label: tr(l, 'cancel'), onTap: () => setState(() => _scanning = false))))),
        ]),
      );
}
