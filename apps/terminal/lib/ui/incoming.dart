import 'package:flutter/material.dart';
import '../app_state.dart';
import '../orders/order.dart';
import 'strings.dart';
import 'theme.dart';
import 'time_sheet.dart';

// A new order covers the screen until someone answers it (the alarm rings meanwhile). Several waiting: they are answered one after another, oldest first.
class IncomingOrder extends StatelessWidget {
  const IncomingOrder({super.key, required this.app, required this.order, required this.waiting});
  final AppState app;
  final Order order;
  final int waiting;

  @override
  Widget build(BuildContext context) {
    final l = app.lang, o = order, c = app.orders!;
    return Positioned.fill(
      child: Material(
        color: const Color(0xFFFFF4F7),
        child: SafeArea(
          child: Padding(padding: const EdgeInsets.all(16), child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
            Row(children: [
              const Icon(Icons.notifications_active, color: brand, size: 30), const SizedBox(width: 8),
              Text(tr(l, 'newOrder'), style: const TextStyle(fontSize: 22, fontWeight: FontWeight.w900, color: brandDeep)), const Spacer(),
              if (waiting > 1) CircleAvatar(radius: 16, backgroundColor: brand, child: Text('$waiting', style: const TextStyle(color: Colors.white, fontWeight: FontWeight.w800))),
            ]),
            const SizedBox(height: 12),
            Expanded(child: Card(elevation: 0, color: Colors.white, child: ListView(padding: const EdgeInsets.all(16), children: [
              Row(children: [
                Text('#${o.number}', style: const TextStyle(fontSize: 30, fontWeight: FontWeight.w900)), const Spacer(),
                Chip(label: Text(tr(l, o.isDelivery ? 'delivery' : o.fulfillment == 'PICKUP' ? 'pickup' : 'dineIn'), style: const TextStyle(fontWeight: FontWeight.w800))),
              ]),
              Text('${o.customerName}  ${o.customerPhone}', style: const TextStyle(fontSize: 16)),
              if (o.isDelivery && (o.address ?? '').isNotEmpty) Padding(padding: const EdgeInsets.only(top: 6), child: Text(o.address!, style: const TextStyle(fontSize: 15, color: Color(0xFF8A5A6E)))),
              const Divider(height: 24),
              for (final i in o.items) Padding(padding: const EdgeInsets.symmetric(vertical: 4), child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
                Text('${i.quantity}×', style: const TextStyle(fontSize: 20, fontWeight: FontWeight.w800)), const SizedBox(width: 10),
                Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                  Text('${i.name}${i.variant != null ? ' (${i.variant})' : ''}', style: const TextStyle(fontSize: 18, fontWeight: FontWeight.w600)),
                  for (final m in i.modifiers) Text('+ $m', style: const TextStyle(fontSize: 14, color: Color(0xFF8A5A6E))),
                  if (i.notes.isNotEmpty) Text(i.notes, style: const TextStyle(fontSize: 14, fontStyle: FontStyle.italic)),
                ])),
                Text(money(i.totalMinor, o.currency), style: const TextStyle(fontSize: 15)),
              ])),
              if (o.note.isNotEmpty) Container(margin: const EdgeInsets.only(top: 10), padding: const EdgeInsets.all(10), decoration: BoxDecoration(color: const Color(0xFFFFF1DC), borderRadius: BorderRadius.circular(10)), child: Text('${tr(l, 'note')}: ${o.note}')),
              const Divider(height: 24),
              Row(children: [Text(tr(l, 'total'), style: const TextStyle(fontSize: 18, fontWeight: FontWeight.w700)), const Spacer(), Text(money(o.totalMinor, o.currency), style: const TextStyle(fontSize: 24, fontWeight: FontWeight.w900))]),
            ]))),
            if (c.error != null) Padding(padding: const EdgeInsets.only(top: 8), child: Text(c.error!, style: const TextStyle(color: Color(0xFFB42318)))),
            const SizedBox(height: 12),
            Row(children: [
              Expanded(child: OutlinedButton(style: OutlinedButton.styleFrom(foregroundColor: const Color(0xFFB42318), side: const BorderSide(color: Color(0xFFB42318), width: 2), minimumSize: const Size.fromHeight(64)), onPressed: c.busy ? null : () => _reject(context), child: Text(tr(l, 'reject')))),
              const SizedBox(width: 12),
              Expanded(flex: 2, child: FilledButton(style: FilledButton.styleFrom(backgroundColor: const Color(0xFF16A34A), minimumSize: const Size.fromHeight(64)), onPressed: c.busy ? null : () => _accept(context), child: Text(tr(l, 'accept')))),
            ]),
          ])),
        ),
      ),
    );
  }

  Future<void> _accept(BuildContext context) async {
    final minutes = await pickTime(context, app, delivery: order.isDelivery);
    if (minutes != null) await app.orders!.accept(order, minutes);
  }

  Future<void> _reject(BuildContext context) async {
    final reason = await pickReason(context, app);
    if (reason != null) await app.orders!.reject(order, reason);
  }
}
