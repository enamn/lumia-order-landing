import 'package:flutter/material.dart';
import '../app_state.dart';
import '../orders/order.dart';
import 'icons.dart';
import 'strings.dart';
import 'theme.dart';
import 'widgets.dart';

// Accept: "Ready in" (pickup) or "Delivery in" N minutes. The customer is told this on WhatsApp.
Future<int?> pickTime(BuildContext context, AppState app, Order order) {
  final l = app.lang;
  var minutes = 20, delivery = order.isDelivery;
  return showLumiaSheet<int>(context, rtl: app.ar, builder: (ctx) => StatefulBuilder(builder: (ctx, set) {
    final eta = DateTime.now().add(Duration(minutes: minutes));
    return Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
      const SizedBox(height: 16),
      Container(
        height: 56, padding: const EdgeInsets.all(4), decoration: BoxDecoration(color: tint, borderRadius: BorderRadius.circular(14), border: Border.all(color: line3)),
        child: Row(children: [for (final m in const [(false, 'readyIn'), (true, 'deliveryIn')]) Expanded(child: GestureDetector(
          onTap: () => set(() => delivery = m.$1), behavior: HitTestBehavior.opaque,
          child: Container(alignment: Alignment.center, decoration: BoxDecoration(color: delivery == m.$1 ? Colors.white : null, borderRadius: BorderRadius.circular(10), boxShadow: delivery == m.$1 ? [BoxShadow(color: ink.withValues(alpha: .12), blurRadius: 3, offset: const Offset(0, 1))] : null),
            child: Text(tr(l, m.$2), style: ts(16, w: 600, color: delivery == m.$1 ? ink : ink2))),
        ))]),
      ),
      const SizedBox(height: 12),
      Text('${tr(l, 'orderTitle')} #${order.number} · ${order.customerName}', style: ts(15, w: 400, color: muted)),
      const SizedBox(height: 16),
      for (final row in const [[10, 15, 20], [30, 45, 60]]) Padding(
        padding: const EdgeInsets.only(bottom: 8),
        child: Row(children: [for (var i = 0; i < 3; i++) ...[
          if (i > 0) const SizedBox(width: 8),
          Expanded(child: GestureDetector(
            onTap: () => set(() => minutes = row[i]), behavior: HitTestBehavior.opaque,
            child: Container(
              height: 56, alignment: Alignment.center,
              decoration: BoxDecoration(color: minutes == row[i] ? pinkTint : Colors.white, borderRadius: BorderRadius.circular(12), border: Border.all(color: minutes == row[i] ? pink : line2, width: 1.5)),
              child: Row(mainAxisSize: MainAxisSize.min, children: [Text('${row[i]}', style: ts(18, w: 600, tabular: true)), const SizedBox(width: 4), Text(tr(l, 'min'), style: ts(15))]),
            ),
          )),
        ]]),
      ),
      const SizedBox(height: 8),
      Row(children: [
        _step('minus', minutes > 5 ? () => set(() => minutes -= 5) : null),
        const SizedBox(width: 12),
        Expanded(child: Column(children: [
          Row(mainAxisAlignment: MainAxisAlignment.center, crossAxisAlignment: CrossAxisAlignment.baseline, textBaseline: TextBaseline.alphabetic, children: [Text('$minutes', style: ts(44, w: 700, ls: -0.03, h: 1, tabular: true)), const SizedBox(width: 6), Text(tr(l, 'min'), style: ts(18))]),
          const SizedBox(height: 6),
          Text('${tr(l, delivery ? 'arrivesBy' : 'readyBy')} ${clock(l, eta)}', style: ts(15, color: ink2)),
        ])),
        const SizedBox(width: 12),
        _step('plus', minutes < 180 ? () => set(() => minutes += 5) : null),
      ]),
      const SizedBox(height: 20),
      GradButton(label: tr(l, 'acceptOrder'), onTap: () => Navigator.pop(ctx, minutes)),
    ]);
  }));
}

Widget _step(String icon, VoidCallback? onTap) => GestureDetector(
      onTap: onTap, behavior: HitTestBehavior.opaque,
      child: Opacity(opacity: onTap == null ? .4 : 1, child: Container(width: 64, height: 64, alignment: Alignment.center, decoration: BoxDecoration(borderRadius: BorderRadius.circular(12), border: Border.all(color: line2, width: 1.5)), child: Ic(icon, size: 26, color: ink, stroke: 2))),
    );

// Reject: four reasons. The reason is sent in English as a code; the server words it for the customer in their own language.
Future<String?> pickReason(BuildContext context, AppState app, Order order) {
  final l = app.lang;
  return showLumiaSheet<String>(context, rtl: app.ar, builder: (ctx) => Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
    Padding(
      padding: const EdgeInsets.fromLTRB(0, 16, 0, 10),
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Text(tr(l, 'rejTitle'), style: ts(22, w: 600, ls: -0.02)), const SizedBox(height: 4),
        Text(trv(l, 'rejSub', {'name': order.customerName}), style: ts(15, color: ink2, h: 1.45)),
      ]),
    ),
    for (final r in const ['r1', 'r2', 'r3', 'r4']) Padding(
      padding: const EdgeInsets.only(bottom: 12),
      child: OutButton(label: tr(l, r), height: 64, size: 18, onTap: () => Navigator.pop(ctx, tr('en', r)), padH: 18),
    ),
    GestureDetector(onTap: () => Navigator.pop(ctx), behavior: HitTestBehavior.opaque, child: Container(height: 56, alignment: Alignment.center, child: Text(tr(l, 'keep'), style: ts(17, w: 600, color: ink2)))),
  ]));
}
