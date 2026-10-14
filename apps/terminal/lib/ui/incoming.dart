import 'package:flutter/material.dart';
import '../app_state.dart';
import '../orders/order.dart';
import 'icons.dart';
import 'orders_screen.dart';
import 'strings.dart';
import 'theme.dart';
import 'time_sheet.dart';
import 'widgets.dart';

// A new order covers the screen until someone answers it (the alarm rings meanwhile). Several waiting: they are answered one after another, oldest first.
class IncomingOrder extends StatelessWidget {
  const IncomingOrder({super.key, required this.app, required this.order, required this.waiting});
  final AppState app;
  final Order order;
  final int waiting;

  @override
  Widget build(BuildContext context) {
    final l = app.lang, o = order, c = app.orders!, mins = DateTime.now().difference(o.createdAt).inMinutes;
    return Positioned.fill(
      child: Material(
        color: Colors.white,
        child: Column(children: [
          Container(
            decoration: const BoxDecoration(gradient: brandGradient), padding: EdgeInsets.fromLTRB(16, MediaQuery.of(context).padding.top + 14, 16, 16),
            child: DefaultTextStyle(
              style: ts(20, color: Colors.white),
              child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
                SizedBox(height: 36, child: Row(children: [
                  const Ic('bell', size: 22, color: Colors.white, stroke: 1.8), const SizedBox(width: 8),
                  Text(tr(l, 'newOrder'), style: ts(20, w: 600, ls: -0.02, color: Colors.white)), const SizedBox(width: 8),
                  Container(padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 2), decoration: BoxDecoration(color: ink.withValues(alpha: .22), borderRadius: BorderRadius.circular(999)), child: Text(mins < 1 ? tr(l, 'now') : agoText(l, mins), style: ts(14, w: 600, color: Colors.white))),
                  const Spacer(),
                  if (waiting > 1) Container(
                    height: 36, padding: const EdgeInsetsDirectional.only(start: 6, end: 12), decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(999)),
                    child: Row(mainAxisSize: MainAxisSize.min, children: [
                      Container(constraints: const BoxConstraints(minWidth: 24), height: 24, padding: const EdgeInsets.symmetric(horizontal: 6), alignment: Alignment.center, decoration: BoxDecoration(gradient: brandGradient, borderRadius: BorderRadius.circular(12)), child: Text('$waiting', style: ts(14, w: 600, color: Colors.white))),
                      const SizedBox(width: 7), Text(tr(l, 'waiting'), style: ts(15, w: 600)),
                    ]),
                  ),
                ])),
                const SizedBox(height: 8),
                Row(crossAxisAlignment: CrossAxisAlignment.baseline, textBaseline: TextBaseline.alphabetic, children: [
                  Text('#${o.number}', style: ts(34, w: 600, ls: -0.02, color: Colors.white, tabular: true)), const SizedBox(width: 10),
                  Text(tr(l, typeKeyOf(o)), style: ts(17, w: 600, color: Colors.white)),
                ]),
              ]),
            ),
          ),
          Expanded(child: SingleChildScrollView(
            padding: const EdgeInsets.fromLTRB(16, 18, 16, 16),
            child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
              Text(money(o.totalMinor, o.currency), style: ts(52, w: 700, ls: -0.035, h: 1)),
              const SizedBox(height: 10),
              Row(children: [const Ic('check', size: 18, color: okFg, stroke: 2.2), const SizedBox(width: 6), Expanded(child: Text(tr(l, 'confirmedWA'), style: ts(15, w: 600, color: okFg)))]),
              const SizedBox(height: 16),
              Container(
                decoration: const BoxDecoration(border: Border(top: BorderSide(color: line3))), padding: const EdgeInsets.only(top: 12),
                child: Column(children: [for (final i in o.items) _item(i, o.currency)]),
              ),
              if (o.note.isNotEmpty) Container(
                margin: const EdgeInsets.only(top: 4), padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12), decoration: BoxDecoration(color: warnBg, borderRadius: BorderRadius.circular(14)),
                child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [Text(tr(l, 'noteLabel'), style: ts(14, w: 600, color: warnFg)), const SizedBox(height: 3), Text(o.note, style: ts(16, color: warnText, h: 1.45))]),
              ),
              const SizedBox(height: 16),
              Text(tr(l, o.isDelivery ? 'deliverTo' : 'customer'), style: ts(14, w: 600, color: muted)),
              const SizedBox(height: 3),
              Text.rich(TextSpan(children: [TextSpan(text: '${o.customerName} · '), WidgetSpan(child: Directionality(textDirection: TextDirection.ltr, child: Text(o.customerPhone, style: ts(16, w: 600))))]), style: ts(16, w: 600)),
              if (o.isDelivery && (o.address ?? '').isNotEmpty) Padding(padding: const EdgeInsets.only(top: 2), child: Text(o.address!, style: ts(16, color: ink2, h: 1.45))),
              if (c.error != null) Padding(padding: const EdgeInsets.only(top: 12), child: Text(c.error!, style: ts(15, color: errFg))),
            ]),
          )),
          Container(
            decoration: const BoxDecoration(color: Colors.white, border: Border(top: BorderSide(color: line3))), padding: EdgeInsets.fromLTRB(16, 12, 16, 24 + MediaQuery.of(context).padding.bottom * .5),
            child: Row(children: [
              Expanded(child: OutButton(label: tr(l, 'reject'), height: 64, size: 18, onTap: c.busy ? null : () => _reject(context))),
              const SizedBox(width: 12),
              Expanded(flex: 2, child: GradButton(label: tr(l, 'accept'), size: 20, glow: true, busy: c.busy, onTap: () => _accept(context))),
            ]),
          ),
        ]),
      ),
    );
  }

  Widget _item(OrderItem i, String cur) {
    final opt = Order.optionsOf(i);
    return Padding(
      padding: const EdgeInsets.only(bottom: 12),
      child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
        ConstrainedBox(constraints: const BoxConstraints(minWidth: 30), child: Text('${i.quantity}×', style: ts(18, w: 600, color: ink2, tabular: true))), const SizedBox(width: 10),
        Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Text(i.name, style: ts(18, w: 600, ls: -0.01)),
          if (opt.isNotEmpty) Padding(padding: const EdgeInsets.only(top: 2), child: Text(opt, style: ts(15, color: ink2))),
        ])),
        const SizedBox(width: 10),
        Text(money(i.totalMinor, cur), style: ts(16, color: ink2)),
      ]),
    );
  }

  Future<void> _accept(BuildContext context) async {
    final minutes = await pickTime(context, app, order);
    if (minutes != null) await app.orders!.accept(order, minutes);
  }

  Future<void> _reject(BuildContext context) async {
    final reason = await pickReason(context, app, order);
    if (reason != null) await app.orders!.reject(order, reason);
  }
}
