import 'package:flutter/material.dart';
import '../app_state.dart';
import '../orders/order.dart';
import 'strings.dart';
import 'theme.dart';

class OrderDetail extends StatelessWidget {
  const OrderDetail({super.key, required this.app, required this.orderId, required this.fallback});
  final AppState app;
  final String orderId;
  final Order fallback;

  @override
  Widget build(BuildContext context) {
    return ListenableBuilder(listenable: app, builder: (context, _) {
      final c = app.orders;
      final o = c?.open.where((x) => x.id == orderId).firstOrNull ?? c?.recent.where((x) => x.id == orderId).firstOrNull ?? fallback;
      final l = app.lang, next = c?.nextStatus(o);
      final label = switch (next) { 'READY' => 'markReady', 'OUT_FOR_DELIVERY' => 'sendOut', 'COMPLETED' => 'complete', _ => '' };
      return Directionality(
        textDirection: app.ar ? TextDirection.rtl : TextDirection.ltr,
        child: Scaffold(
          appBar: AppBar(title: Text('#${o.number}', style: const TextStyle(fontWeight: FontWeight.w800)), actions: [
            IconButton(icon: const Icon(Icons.print), tooltip: tr(l, 'print'), onPressed: () async {
              final ok = await c?.reprint(o) ?? false;
              if (context.mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(tr(l, ok ? 'printed' : 'printFail'))));
            }),
          ]),
          body: ListView(padding: const EdgeInsets.all(16), children: [
            Text('${o.customerName}  ${o.customerPhone}', style: const TextStyle(fontSize: 17, fontWeight: FontWeight.w600)),
            if (o.isDelivery && (o.address ?? '').isNotEmpty) Padding(padding: const EdgeInsets.only(top: 6), child: Text(o.address!, style: const TextStyle(fontSize: 15))),
            if (o.promisedAt != null) Padding(padding: const EdgeInsets.only(top: 6), child: Text('${tr(l, 'by')} ${TimeOfDay.fromDateTime(o.promisedAt!).format(context)}', style: const TextStyle(color: brandDeep, fontWeight: FontWeight.w700))),
            const Divider(height: 28),
            for (final i in o.items) Padding(padding: const EdgeInsets.symmetric(vertical: 5), child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Text('${i.quantity}×', style: const TextStyle(fontSize: 18, fontWeight: FontWeight.w800)), const SizedBox(width: 10),
              Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                Text('${i.name}${i.variant != null ? ' (${i.variant})' : ''}', style: const TextStyle(fontSize: 17)),
                for (final m in i.modifiers) Text('+ $m', style: const TextStyle(fontSize: 14, color: Color(0xFF8A5A6E))),
                if (i.notes.isNotEmpty) Text(i.notes, style: const TextStyle(fontSize: 14, fontStyle: FontStyle.italic)),
              ])),
              Text(money(i.totalMinor, o.currency)),
            ])),
            if (o.note.isNotEmpty) Padding(padding: const EdgeInsets.only(top: 10), child: Text('${tr(l, 'note')}: ${o.note}')),
            const Divider(height: 28),
            if (o.discountMinor > 0) _row(tr(l, 'discount'), '- ${money(o.discountMinor, o.currency)}'),
            if (o.deliveryFeeMinor > 0) _row(tr(l, 'fee'), money(o.deliveryFeeMinor, o.currency)),
            _row(tr(l, 'total'), money(o.totalMinor, o.currency), big: true),
            if (c?.error != null) Padding(padding: const EdgeInsets.only(top: 10), child: Text(c!.error!, style: const TextStyle(color: Color(0xFFB42318)))),
          ]),
          bottomNavigationBar: next == null ? null : SafeArea(child: Padding(padding: const EdgeInsets.all(16), child: FilledButton(onPressed: c!.busy ? null : () async { if (await c.advance(o) && next == 'COMPLETED' && context.mounted) Navigator.pop(context); }, child: Text(tr(l, label))))),
        ),
      );
    });
  }

  Widget _row(String a, String b, {bool big = false}) => Padding(padding: const EdgeInsets.symmetric(vertical: 3), child: Row(children: [Text(a, style: TextStyle(fontSize: big ? 18 : 15, fontWeight: big ? FontWeight.w800 : FontWeight.w500)), const Spacer(), Text(b, style: TextStyle(fontSize: big ? 22 : 15, fontWeight: big ? FontWeight.w900 : FontWeight.w500))]));
}
