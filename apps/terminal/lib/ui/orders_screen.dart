import 'dart:async';
import 'package:flutter/material.dart';
import '../app_state.dart';
import '../orders/order.dart';
import 'icons.dart';
import 'incoming.dart';
import 'order_detail.dart';
import 'settings_sheet.dart';
import 'strings.dart';
import 'theme.dart';
import 'widgets.dart';

class OrdersScreen extends StatefulWidget {
  const OrdersScreen({super.key, required this.app});
  final AppState app;
  @override
  State<OrdersScreen> createState() => _OrdersScreenState();
}

class _OrdersScreenState extends State<OrdersScreen> {
  Stage _tab = Stage.kitchen;
  Timer? _tick;
  static const _tabs = [(Stage.fresh, 'new'), (Stage.kitchen, 'preparing'), (Stage.ready, 'ready'), (Stage.out, 'out'), (Stage.done, 'done')];

  @override
  void initState() { super.initState(); _tick = Timer.periodic(const Duration(seconds: 20), (_) { if (mounted) setState(() {}); }); } // keeps "4 min ago" fresh
  @override
  void dispose() { _tick?.cancel(); super.dispose(); }

  @override
  Widget build(BuildContext context) {
    final app = widget.app, c = app.orders!, l = app.lang, fresh = c.fresh;
    final list = _tab == Stage.done ? c.recent : c.inStage(_tab);
    final key = _tabs.firstWhere((t) => t.$1 == _tab).$2;
    return Directionality(
      textDirection: app.ar ? TextDirection.rtl : TextDirection.ltr,
      child: Stack(children: [
        Scaffold(
          backgroundColor: tint,
          body: SafeArea(
            bottom: false,
            child: Column(children: [
              _topBar(app, l),
              SizedBox(height: 64, child: ListView(scrollDirection: Axis.horizontal, padding: const EdgeInsets.symmetric(horizontal: 16), children: [
                for (final t in _tabs) Padding(padding: const EdgeInsetsDirectional.only(end: 8), child: Center(child: _tabChip(l, t.$1, t.$2, t.$1 == Stage.done ? c.recent.length : c.inStage(t.$1).length))),
              ])),
              if (!app.online) _offlineBanner(app, l),
              if (c.error != null) Padding(padding: const EdgeInsets.fromLTRB(16, 0, 16, 12), child: Text(c.error!, style: ts(14, color: errFg))),
              Expanded(child: !c.loaded ? _skeleton() : list.isEmpty ? _empty(l, key) : _cards(list, l)),
            ]),
          ),
        ),
        if (fresh.isNotEmpty) IncomingOrder(app: app, order: fresh.first, waiting: fresh.length),
      ]),
    );
  }

  Widget _topBar(AppState app, String l) => Container(
        height: 64, padding: const EdgeInsetsDirectional.only(start: 16, end: 8), decoration: const BoxDecoration(color: Colors.white, border: Border(bottom: BorderSide(color: line3))),
        child: Row(children: [
          const LumiaMark(size: 34), const SizedBox(width: 10),
          Expanded(child: Column(mainAxisAlignment: MainAxisAlignment.center, crossAxisAlignment: CrossAxisAlignment.start, children: [
            Text(app.session?.business ?? '', maxLines: 1, overflow: TextOverflow.ellipsis, style: ts(18, w: 600, ls: -0.02)),
            const SizedBox(height: 2),
            Row(children: [
              Container(width: 8, height: 8, decoration: BoxDecoration(color: app.online ? okFg : errFg, shape: BoxShape.circle)), const SizedBox(width: 6),
              Text(tr(l, app.online ? 'online' : 'offline'), style: ts(14, w: 600, color: app.online ? okFg : errFg)),
              Flexible(child: Text(' · ${app.session?.branch ?? ''}', maxLines: 1, overflow: TextOverflow.ellipsis, style: ts(14, w: 400, color: muted))),
            ]),
          ])),
          IconButton(onPressed: () => showSettings(context, app), icon: const Ic('sliders', color: ink2), style: IconButton.styleFrom(fixedSize: const Size(48, 48), shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)))),
        ]),
      );

  Widget _tabChip(String l, Stage st, String key, int n) {
    final sel = st == _tab;
    return GestureDetector(
      onTap: () => setState(() => _tab = st),
      child: Container(
        height: 44, padding: const EdgeInsets.symmetric(horizontal: 14), alignment: Alignment.center,
        decoration: BoxDecoration(color: sel ? pinkTint : Colors.white, borderRadius: BorderRadius.circular(999), border: Border.all(color: sel ? pink : line)),
        child: Row(mainAxisSize: MainAxisSize.min, children: [
          Text(tr(l, key), style: ts(15, w: 600)), const SizedBox(width: 7),
          Text('$n', style: ts(15, w: 600, color: sel ? pinkText : muted, tabular: true)),
        ]),
      ),
    );
  }

  Widget _offlineBanner(AppState app, String l) => Container(
        margin: const EdgeInsets.fromLTRB(16, 0, 16, 12), padding: const EdgeInsetsDirectional.fromSTEB(14, 12, 12, 12),
        decoration: BoxDecoration(color: errBg, borderRadius: BorderRadius.circular(14), border: Border.all(color: errLine)),
        child: Row(children: [
          const Ic('alert', size: 22, color: errText, stroke: 1.8), const SizedBox(width: 10),
          Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Text(tr(l, 'offTitle'), style: ts(16, w: 600, color: errText)),
            const SizedBox(height: 2),
            Text(tr(l, 'offBody'), style: ts(14, color: errText, h: 1.4)),
          ])),
          const SizedBox(width: 10),
          OutButton(label: tr(l, 'retry'), onTap: app.retry, height: 44, size: 15, border: errLine, padH: 14),
        ]),
      );

  Widget _cards(List<Order> list, String l) => ListView.separated(
        padding: const EdgeInsets.fromLTRB(16, 0, 16, 16), itemCount: list.length, separatorBuilder: (_, _) => const SizedBox(height: 12),
        itemBuilder: (context, i) {
          final o = list[i], mins = DateTime.now().difference(o.createdAt).inMinutes;
          return LineCard(
            onTap: () => Navigator.of(context).push(MaterialPageRoute(builder: (_) => OrderDetail(app: widget.app, orderId: o.id, fallback: o))),
            child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
              Row(children: [
                Text('#${o.number}', style: ts(22, w: 600, ls: -0.02, tabular: true)), const SizedBox(width: 8),
                Container(height: 28, padding: const EdgeInsets.symmetric(horizontal: 10), alignment: Alignment.center, decoration: BoxDecoration(borderRadius: BorderRadius.circular(999), border: Border.all(color: line2)), child: Text(tr(l, _typeKey(o)), style: ts(14, w: 600, color: ink2))),
                const Spacer(),
                Text(agoText(l, mins), style: ts(14, w: 400, color: muted)),
              ]),
              const SizedBox(height: 8),
              Text.rich(TextSpan(children: [TextSpan(text: o.customerName, style: ts(16, w: 600)), TextSpan(text: ' · ${o.items.map((i) => '${i.quantity} ${i.name}').join(', ')}')]), maxLines: 1, overflow: TextOverflow.ellipsis, style: ts(16, w: 400, color: ink2)),
              const SizedBox(height: 8),
              Row(children: [
                if (o.promisedAt != null) Container(
                  height: 30, padding: const EdgeInsets.symmetric(horizontal: 10), decoration: BoxDecoration(color: warnBg, borderRadius: BorderRadius.circular(999)),
                  child: Row(mainAxisSize: MainAxisSize.min, children: [const Ic('clock', size: 16, color: warnFg, stroke: 1.8), const SizedBox(width: 6), Text('${tr(l, 'readyByShort')} ${clock(l, o.promisedAt!)}', style: ts(14, w: 600, color: warnFg))]),
                ),
                const Spacer(),
                Text(money(o.totalMinor, o.currency), style: ts(22, w: 600, ls: -0.01)),
              ]),
            ]),
          );
        },
      );

  Widget _empty(String l, String key) => Padding(
        padding: const EdgeInsets.fromLTRB(32, 0, 32, 80),
        child: Center(child: Column(mainAxisSize: MainAxisSize.min, children: [
          Container(width: 104, height: 104, decoration: const BoxDecoration(gradient: softGradient, shape: BoxShape.circle), child: const Center(child: Ic('bag', size: 44, color: muted, stroke: 1.5))),
          const SizedBox(height: 20),
          Text(tr(l, 'emptyTitle_$key'), style: ts(22, w: 600, ls: -0.02), textAlign: TextAlign.center),
          const SizedBox(height: 6),
          Text(tr(l, 'emptyBody_$key'), style: ts(16, color: ink2, h: 1.5), textAlign: TextAlign.center),
        ])),
      );

  Widget _skeleton() => ListView(padding: const EdgeInsets.symmetric(horizontal: 16), physics: const NeverScrollableScrollPhysics(), children: [
        for (final w in const [.78, .64, .84, .58]) Padding(
          padding: const EdgeInsets.only(bottom: 12),
          child: Container(
            padding: const EdgeInsets.all(16), decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(14), border: Border.all(color: line3)),
            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Row(children: [_bone(72, 22, 6, const Color(0xFFF3E7EC)), const SizedBox(width: 8), _bone(64, 22, 999, const Color(0xFFF7EEF2))]),
              const SizedBox(height: 12),
              FractionallySizedBox(widthFactor: w, child: _bone(double.infinity, 16, 5, const Color(0xFFF7EEF2))),
              const SizedBox(height: 12),
              Row(mainAxisAlignment: MainAxisAlignment.spaceBetween, children: [_bone(120, 26, 999, const Color(0xFFF7EEF2)), _bone(76, 22, 6, const Color(0xFFF3E7EC))]),
            ]),
          ),
        ),
      ]);

  Widget _bone(double w, double h, double r, Color c) => Container(width: w == double.infinity ? null : w, height: h, decoration: BoxDecoration(color: c, borderRadius: BorderRadius.circular(r)));
}

String _typeKey(Order o) => o.isDelivery ? 'delivery' : o.fulfillment == 'PICKUP' ? 'pickup' : 'dineIn';
String typeKeyOf(Order o) => _typeKey(o);
