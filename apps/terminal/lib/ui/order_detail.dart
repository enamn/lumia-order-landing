import 'package:flutter/material.dart';
import '../app_state.dart';
import '../orders/order.dart';
import 'icons.dart';
import 'orders_screen.dart';
import 'strings.dart';
import 'theme.dart';
import 'widgets.dart';

class OrderDetail extends StatefulWidget {
  const OrderDetail({super.key, required this.app, required this.orderId, required this.fallback});
  final AppState app;
  final String orderId;
  final Order fallback;
  @override
  State<OrderDetail> createState() => _OrderDetailState();
}

class _OrderDetailState extends State<OrderDetail> {
  bool _printing = false, _printFailed = false;

  Future<void> _print(Order o) async {
    setState(() { _printing = true; _printFailed = false; });
    final ok = await widget.app.orders!.reprint(o);
    if (mounted) setState(() { _printing = false; _printFailed = !ok; });
  }

  (Color, Color, String) _status(Order o) => switch (o.status) {
        'AWAITING_BUSINESS_CONFIRMATION' => (const Color(0xFFFDEAF2), const Color(0xFF8A2040), 'new'),
        'ACCEPTED' || 'PREPARING' => (warnBg, warnFg, 'preparing'),
        'READY' => (const Color(0xFFF1E6FF), const Color(0xFF6A1FA0), 'ready'),
        'OUT_FOR_DELIVERY' => (const Color(0xFFF6EEF2), ink2, 'out'),
        'REJECTED' || 'CANCELLED' => (errBg, errFg, 'rejected'),
        _ => (okBg, okFg, 'done'),
      };

  @override
  Widget build(BuildContext context) {
    final app = widget.app;
    return ListenableBuilder(listenable: app, builder: (context, _) {
      final c = app.orders;
      final o = c?.open.where((x) => x.id == widget.orderId).firstOrNull ?? c?.recent.where((x) => x.id == widget.orderId).firstOrNull ?? widget.fallback;
      final l = app.lang, next = c?.nextStatus(o), st = _status(o), cur = o.currency;
      final label = switch (next) { 'READY' => 'markReady', 'OUT_FOR_DELIVERY' => 'sendOut', 'COMPLETED' => 'complete', _ => '' };
      return Directionality(
        textDirection: app.ar ? TextDirection.rtl : TextDirection.ltr,
        child: Scaffold(
          backgroundColor: tint,
          body: SafeArea(
            bottom: false,
            child: Stack(children: [
              Column(children: [
                Container(
                  height: 56, padding: const EdgeInsetsDirectional.only(start: 4, end: 16), decoration: const BoxDecoration(color: Colors.white, border: Border(bottom: BorderSide(color: line3))),
                  child: Row(children: [
                    IconButton(onPressed: () => Navigator.pop(context), icon: const Ic('back', color: ink, stroke: 2, flipInRtl: true), style: IconButton.styleFrom(fixedSize: const Size(48, 48))),
                    const SizedBox(width: 4),
                    Expanded(child: Text('${tr(l, 'orderTitle')} #${o.number}', style: ts(20, w: 600, ls: -0.02))),
                    StatusPill(label: tr(l, st.$3), bg: st.$1, fg: st.$2),
                  ]),
                ),
                Expanded(child: ListView(padding: const EdgeInsets.all(16), children: [
                  if (o.promisedAt != null) ...[
                    LineCard(child: Row(children: [
                      Container(width: 44, height: 44, decoration: BoxDecoration(color: warnBg, borderRadius: BorderRadius.circular(12)), child: const Center(child: Ic('clock', size: 22, color: warnFg, stroke: 1.8))), const SizedBox(width: 12),
                      Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                        Text('${tr(l, 'readyBy')} ${clock(l, o.promisedAt!)}', style: ts(24, w: 600, ls: -0.02)),
                        if (o.acceptedAt != null) Padding(padding: const EdgeInsets.only(top: 2), child: Text(trv(l, 'acceptedAt', {'t': clock(l, o.acceptedAt!), 'type': tr(l, typeKeyOf(o))}), style: ts(14, w: 400, color: muted))),
                      ])),
                    ])),
                    const SizedBox(height: 12),
                  ],
                  LineCard(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                    Text(tr(l, 'customer'), style: ts(14, w: 600, color: muted)), const SizedBox(height: 4),
                    Text.rich(TextSpan(children: [TextSpan(text: '${o.customerName} · '), WidgetSpan(child: Directionality(textDirection: TextDirection.ltr, child: Text(o.customerPhone, style: ts(18, w: 500))))]), style: ts(18, w: 600)),
                    if (o.isDelivery && (o.address ?? '').isNotEmpty) Padding(padding: const EdgeInsets.only(top: 2), child: Text(o.address!, style: ts(16, color: ink2, h: 1.45))),
                  ])),
                  const SizedBox(height: 12),
                  LineCard(child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
                    Text(tr(l, 'itemsLabel'), style: ts(14, w: 600, color: muted)), const SizedBox(height: 10),
                    for (final i in o.items) Padding(padding: const EdgeInsets.only(bottom: 10), child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
                      ConstrainedBox(constraints: const BoxConstraints(minWidth: 28), child: Text('${i.quantity}×', style: ts(17, w: 600, color: ink2))), const SizedBox(width: 10),
                      Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                        Text(i.name, style: ts(17, w: 600)),
                        if (Order.optionsOf(i).isNotEmpty) Padding(padding: const EdgeInsets.only(top: 2), child: Text(Order.optionsOf(i), style: ts(15, color: ink2))),
                      ])),
                      const SizedBox(width: 10), Text(money(i.totalMinor, cur), style: ts(16, w: 400, color: ink2)),
                    ])),
                    Container(
                      margin: const EdgeInsets.only(top: 4), padding: const EdgeInsets.only(top: 10), decoration: const BoxDecoration(border: Border(top: BorderSide(color: line3))),
                      child: Column(children: [
                        _line(tr(l, 'subtotal'), money(o.subtotalMinor, cur)),
                        if (o.discountMinor > 0) _line('${tr(l, 'discount')}${o.discountCode != null ? ' (${o.discountCode})' : ''}', '− ${money(o.discountMinor, cur)}'),
                        if (o.deliveryFeeMinor > 0) _line(tr(l, 'fee'), money(o.deliveryFeeMinor, cur)),
                        const SizedBox(height: 4),
                        Row(crossAxisAlignment: CrossAxisAlignment.baseline, textBaseline: TextBaseline.alphabetic, children: [Text(tr(l, 'total'), style: ts(18, w: 600)), const Spacer(), Text(money(o.totalMinor, cur), style: ts(24, w: 700, ls: -0.02))]),
                      ]),
                    ),
                  ])),
                  if (o.note.isNotEmpty) Container(
                    margin: const EdgeInsets.only(top: 12), padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12), decoration: BoxDecoration(color: warnBg, borderRadius: BorderRadius.circular(14)),
                    child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [Text(tr(l, 'noteLabel'), style: ts(14, w: 600, color: warnFg)), const SizedBox(height: 3), Text(o.note, style: ts(16, color: warnText, h: 1.45))]),
                  ),
                  if (c?.error != null) Padding(padding: const EdgeInsets.only(top: 12), child: Text(c!.error!, style: ts(15, color: errFg))),
                ])),
                Container(
                  decoration: const BoxDecoration(color: Colors.white, border: Border(top: BorderSide(color: line3))), padding: const EdgeInsets.fromLTRB(16, 12, 16, 24),
                  child: Row(children: [
                    SizedBox(width: 112, child: OutButton(label: tr(l, 'print'), icon: 'print', height: 64, onTap: _printing ? null : () => _print(o))),
                    if (next != null) ...[const SizedBox(width: 12), Expanded(child: GradButton(label: tr(l, label), busy: c?.busy ?? false, onTap: () async { if (await c!.advance(o) && next == 'COMPLETED' && context.mounted) Navigator.pop(context); }))],
                  ]),
                ),
              ]),
              if (_printing) Positioned(left: 0, right: 0, bottom: 116, child: Center(child: Container(
                height: 52, padding: const EdgeInsets.symmetric(horizontal: 20), decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(999), border: Border.all(color: line), boxShadow: [BoxShadow(color: const Color(0xFF8A2040).withValues(alpha: .45), blurRadius: 28, offset: const Offset(0, 14), spreadRadius: -14)]),
                child: Row(mainAxisSize: MainAxisSize.min, children: [const SizedBox(width: 20, height: 20, child: CircularProgressIndicator(strokeWidth: 2.4, color: pink, backgroundColor: Color(0xFFF3E1E9))), const SizedBox(width: 10), Text(tr(l, 'printing'), style: ts(16, w: 600))]),
              ))),
              if (_printFailed) Positioned(left: 16, right: 16, bottom: 116, child: Container(
                padding: const EdgeInsetsDirectional.fromSTEB(14, 12, 12, 12), decoration: BoxDecoration(color: errBg, borderRadius: BorderRadius.circular(14), border: Border.all(color: errLine), boxShadow: [BoxShadow(color: errFg.withValues(alpha: .45), blurRadius: 28, offset: const Offset(0, 14), spreadRadius: -16)]),
                child: Row(children: [
                  const Ic('alert', size: 22, color: errText, stroke: 1.8), const SizedBox(width: 10),
                  Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [Text(tr(l, 'printFail'), style: ts(16, w: 600, color: errText)), const SizedBox(height: 2), Text(tr(l, 'printFailBody'), style: ts(14, color: errText, h: 1.4))])),
                  const SizedBox(width: 10),
                  GestureDetector(onTap: () => _print(o), child: Container(height: 48, padding: const EdgeInsets.symmetric(horizontal: 16), alignment: Alignment.center, decoration: BoxDecoration(color: errFg, borderRadius: BorderRadius.circular(12)), child: Text(tr(l, 'retry'), style: ts(15, w: 600, color: Colors.white)))),
                ]),
              )),
            ]),
          ),
        ),
      );
    });
  }

  Widget _line(String k, String v) => Padding(padding: const EdgeInsets.only(bottom: 6), child: Row(mainAxisAlignment: MainAxisAlignment.spaceBetween, children: [Flexible(child: Text(k, style: ts(16, w: 400, color: ink2))), const SizedBox(width: 12), Text(v, style: ts(16, w: 400, color: ink2))]));
}
