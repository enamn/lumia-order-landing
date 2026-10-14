import 'package:flutter/material.dart';
import '../app_state.dart';
import '../core/config.dart';
import 'icons.dart';
import 'strings.dart';
import 'theme.dart';
import 'widgets.dart';

void showSettings(BuildContext context, AppState app) {
  showLumiaSheet<void>(context, rtl: app.ar, builder: (sheet) => ListenableBuilder(listenable: app, builder: (ctx, _) {
    final l = app.lang;
    return Directionality(
      textDirection: app.ar ? TextDirection.rtl : TextDirection.ltr,
      child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
        Padding(padding: const EdgeInsets.fromLTRB(0, 14, 0, 6), child: Text(tr(l, 'setTitle'), style: ts(22, w: 600, ls: -0.02))),
        _row(minH: 64, child: GestureDetector(
          onTap: () => app.setAlarmOn(!app.store.alarmOn), behavior: HitTestBehavior.opaque,
          child: Row(children: [Expanded(child: Text(tr(l, 'alarm'), style: ts(17))), Text(tr(l, app.store.alarmOn ? 'alarmOn' : 'alarmOff'), style: ts(15, w: 400, color: ink2)), const SizedBox(width: 12), const Ic('forward', size: 20, color: muted, stroke: 2, flipInRtl: true)]),
        )),
        _row(minH: 64, child: Row(children: [Expanded(child: Text(tr(l, 'printOnAccept'), style: ts(17))), GradSwitch(on: app.store.autoPrint, onChanged: app.setAutoPrint)])),
        _row(minH: 72, child: Row(children: [Expanded(child: Text(tr(l, 'language'), style: ts(17))), LangSwitch(lang: l, onChanged: app.setLang, padH: 14)])),
        _row(minH: 64, last: true, child: Row(children: [Expanded(child: Text(tr(l, 'terminal'), style: ts(17))), Directionality(textDirection: TextDirection.ltr, child: Text('${app.model} · v$appVersion', style: ts(15, w: 400, color: ink2)))])),
        const SizedBox(height: 12),
        OutButton(label: tr(l, 'disconnect'), color: errFg, border: errLine, onTap: () async {
          final yes = await showLumiaDialog<bool>(ctx, rtl: app.ar, scrimAlpha: .35, builder: (d) => Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
            Text(tr(l, 'dcTitle'), style: ts(22, w: 600, ls: -0.02)), const SizedBox(height: 8),
            Text(tr(l, 'dcBody'), style: ts(16, color: ink2, h: 1.5)), const SizedBox(height: 22),
            Row(children: [
              Expanded(child: OutButton(label: tr(l, 'cancel'), onTap: () => Navigator.pop(d, false))), const SizedBox(width: 12),
              Expanded(child: GestureDetector(onTap: () => Navigator.pop(d, true), child: Container(height: 56, alignment: Alignment.center, decoration: BoxDecoration(color: errFg, borderRadius: BorderRadius.circular(12)), child: Text(tr(l, 'dcBtn'), style: ts(17, w: 600, color: Colors.white))))),
            ]),
          ]));
          if (yes == true) { if (sheet.mounted) Navigator.pop(sheet); await app.unpair(); }
        }),
      ]),
    );
  }));
}

Widget _row({required double minH, required Widget child, bool last = false}) => Container(
      constraints: BoxConstraints(minHeight: minH), alignment: Alignment.center, decoration: BoxDecoration(border: last ? null : const Border(bottom: BorderSide(color: line3))), child: child);
