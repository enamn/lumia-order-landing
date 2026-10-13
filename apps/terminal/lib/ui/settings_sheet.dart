import 'package:flutter/material.dart';
import '../app_state.dart';
import 'strings.dart';

void showSettings(BuildContext context, AppState app) {
  showModalBottomSheet(context: context, showDragHandle: true, isScrollControlled: true, builder: (_) => ListenableBuilder(listenable: app, builder: (ctx, _) {
    final l = app.lang;
    return Directionality(
      textDirection: app.ar ? TextDirection.rtl : TextDirection.ltr,
      child: SafeArea(child: Padding(padding: const EdgeInsets.fromLTRB(20, 0, 20, 16), child: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.stretch, children: [
        Text(tr(l, 'settings'), style: const TextStyle(fontSize: 20, fontWeight: FontWeight.w800)),
        Text('${app.session?.business ?? ''} · ${app.session?.branch ?? ''}', style: const TextStyle(color: Color(0xFF8A5A6E))),
        SwitchListTile(contentPadding: EdgeInsets.zero, title: Text(tr(l, 'alarm')), value: app.store.alarmOn, onChanged: app.setAlarmOn),
        SwitchListTile(contentPadding: EdgeInsets.zero, title: Text(tr(l, 'autoPrint')), value: app.store.autoPrint, onChanged: app.setAutoPrint),
        ListTile(contentPadding: EdgeInsets.zero, title: Text(tr(l, 'language')), trailing: SegmentedButton<String>(segments: const [ButtonSegment(value: 'en', label: Text('EN')), ButtonSegment(value: 'ar', label: Text('عربي'))], selected: {app.lang}, onSelectionChanged: (s) => app.setLang(s.first))),
        const SizedBox(height: 8),
        OutlinedButton(style: OutlinedButton.styleFrom(foregroundColor: const Color(0xFFB42318)), onPressed: () async {
          final yes = await showDialog<bool>(context: ctx, builder: (d) => AlertDialog(content: Text(tr(l, 'disconnectAsk')), actions: [TextButton(onPressed: () => Navigator.pop(d, false), child: Text(tr(l, 'cancel'))), TextButton(onPressed: () => Navigator.pop(d, true), child: Text(tr(l, 'disconnect')))]));
          if (yes == true) { if (ctx.mounted) Navigator.pop(ctx); await app.unpair(); }
        }, child: Text(tr(l, 'disconnect'))),
      ]))),
    );
  }));
}
