import 'package:flutter/material.dart';
import '../app_state.dart';
import 'strings.dart';
import 'theme.dart';

// "Ready in N minutes": the customer is told this on WhatsApp.
Future<int?> pickTime(BuildContext context, AppState app, {required bool delivery}) {
  var minutes = delivery ? 35 : 20;
  final l = app.lang;
  return showModalBottomSheet<int>(
    context: context, isScrollControlled: true, showDragHandle: true,
    builder: (_) => Directionality(
      textDirection: app.ar ? TextDirection.rtl : TextDirection.ltr,
      child: StatefulBuilder(builder: (ctx, set) => Padding(
        padding: EdgeInsets.fromLTRB(20, 4, 20, 20 + MediaQuery.of(ctx).viewInsets.bottom),
        child: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.stretch, children: [
          Text(tr(l, delivery ? 'readyInDelivery' : 'readyIn'), style: const TextStyle(fontSize: 20, fontWeight: FontWeight.w800)),
          const SizedBox(height: 14),
          Wrap(spacing: 8, runSpacing: 8, children: [for (final m in [10, 15, 20, 30, 45, 60]) ChoiceChip(selected: minutes == m, selectedColor: brandDeep, labelStyle: TextStyle(fontSize: 17, fontWeight: FontWeight.w700, color: minutes == m ? Colors.white : ink), label: Text('$m'), onSelected: (_) => set(() => minutes = m))]),
          const SizedBox(height: 14),
          Row(mainAxisAlignment: MainAxisAlignment.center, children: [
            IconButton.filledTonal(iconSize: 30, onPressed: minutes > 5 ? () => set(() => minutes -= 5) : null, icon: const Icon(Icons.remove)),
            Padding(padding: const EdgeInsets.symmetric(horizontal: 24), child: Text('$minutes ${tr(l, 'min')}', style: const TextStyle(fontSize: 28, fontWeight: FontWeight.w900))),
            IconButton.filledTonal(iconSize: 30, onPressed: minutes < 180 ? () => set(() => minutes += 5) : null, icon: const Icon(Icons.add)),
          ]),
          const SizedBox(height: 18),
          FilledButton(style: FilledButton.styleFrom(backgroundColor: const Color(0xFF16A34A), minimumSize: const Size.fromHeight(60)), onPressed: () => Navigator.pop(ctx, minutes), child: Text(tr(l, 'confirmAccept'))),
        ]),
      )),
    ),
  );
}

Future<String?> pickReason(BuildContext context, AppState app) {
  final l = app.lang;
  return showModalBottomSheet<String>(
    context: context, showDragHandle: true,
    builder: (ctx) => Directionality(
      textDirection: app.ar ? TextDirection.rtl : TextDirection.ltr,
      child: Padding(padding: const EdgeInsets.fromLTRB(20, 4, 20, 20), child: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.stretch, children: [
        Text(tr(l, 'why'), style: const TextStyle(fontSize: 20, fontWeight: FontWeight.w800)),
        const SizedBox(height: 12),
        for (final r in ['r1', 'r2', 'r3', 'r4']) Padding(padding: const EdgeInsets.only(bottom: 8), child: OutlinedButton(onPressed: () => Navigator.pop(ctx, tr(l, r)), child: Text(tr(l, r)))),
      ])),
    ),
  );
}
