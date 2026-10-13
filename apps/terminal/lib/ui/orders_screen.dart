import 'dart:async';
import 'package:flutter/material.dart';
import '../app_state.dart';
import '../orders/order.dart';
import 'order_detail.dart';
import 'incoming.dart';
import 'settings_sheet.dart';
import 'strings.dart';
import 'theme.dart';

class OrdersScreen extends StatefulWidget {
  const OrdersScreen({super.key, required this.app});
  final AppState app;
  @override
  State<OrdersScreen> createState() => _OrdersScreenState();
}

class _OrdersScreenState extends State<OrdersScreen> {
  Stage _tab = Stage.fresh;
  Timer? _tick;

  @override
  void initState() { super.initState(); _tick = Timer.periodic(const Duration(seconds: 20), (_) => setState(() {})); } // keeps "3 min ago" fresh
  @override
  void dispose() { _tick?.cancel(); super.dispose(); }

  @override
  Widget build(BuildContext context) {
    final app = widget.app, c = app.orders!, l = app.lang;
    final fresh = c.fresh;
    final tabs = [(Stage.fresh, 'new'), (Stage.kitchen, 'preparing'), (Stage.ready, 'ready'), (Stage.out, 'out'), (Stage.done, 'recent')];
    final list = _tab == Stage.done ? c.recent : c.inStage(_tab);
    return Directionality(
      textDirection: app.ar ? TextDirection.rtl : TextDirection.ltr,
      child: Stack(children: [
        Scaffold(
          appBar: AppBar(
            titleSpacing: 12, backgroundColor: Colors.white, surfaceTintColor: Colors.white,
            title: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Text(app.session?.branch ?? '', style: const TextStyle(fontSize: 17, fontWeight: FontWeight.w800)),
              Row(children: [Icon(Icons.circle, size: 10, color: app.online ? const Color(0xFF16A34A) : const Color(0xFFD97706)), const SizedBox(width: 6), Text(tr(l, app.online ? 'online' : 'offline'), style: const TextStyle(fontSize: 12))]),
            ]),
            actions: [IconButton(icon: const Icon(Icons.settings), onPressed: () => showSettings(context, app))],
          ),
          body: Column(children: [
            SizedBox(height: 56, child: ListView(scrollDirection: Axis.horizontal, padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 8), children: [
              for (final t in tabs)
                Padding(padding: const EdgeInsets.symmetric(horizontal: 4), child: ChoiceChip(
                  selected: _tab == t.$1, onSelected: (_) => setState(() => _tab = t.$1), selectedColor: brandDeep,
                  labelStyle: TextStyle(fontWeight: FontWeight.w700, color: _tab == t.$1 ? Colors.white : ink),
                  label: Text('${tr(l, t.$2)}${t.$1 != Stage.done && c.inStage(t.$1).isNotEmpty ? '  ${c.inStage(t.$1).length}' : ''}'))),
            ])),
            if (c.error != null) Container(width: double.infinity, color: const Color(0xFFFDECEC), padding: const EdgeInsets.all(10), child: Text(c.error!, style: const TextStyle(color: Color(0xFFB42318)))),
            Expanded(child: list.isEmpty
                ? Center(child: Text(tr(l, 'none'), style: const TextStyle(color: Color(0xFF8A5A6E), fontSize: 16)))
                : ListView.separated(padding: const EdgeInsets.all(12), itemCount: list.length, separatorBuilder: (_, _) => const SizedBox(height: 10), itemBuilder: (_, i) => _card(context, list[i], l))),
          ]),
        ),
        if (fresh.isNotEmpty) IncomingOrder(app: app, order: fresh.first, waiting: fresh.length),
      ]),
    );
  }

  Widget _card(BuildContext context, Order o, String l) {
    final mins = DateTime.now().difference(o.createdAt).inMinutes;
    return Card(
      elevation: 0, color: Colors.white, shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14), side: const BorderSide(color: Color(0xFFF0E4E8))),
      child: InkWell(
        borderRadius: BorderRadius.circular(14),
        onTap: () => Navigator.of(context).push(MaterialPageRoute(builder: (_) => OrderDetail(app: widget.app, orderId: o.id, fallback: o))),
        child: Padding(padding: const EdgeInsets.all(14), child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Row(children: [
            Text('#${o.number}', style: const TextStyle(fontSize: 20, fontWeight: FontWeight.w800)), const SizedBox(width: 10),
            Chip(visualDensity: VisualDensity.compact, label: Text(tr(l, o.isDelivery ? 'delivery' : o.fulfillment == 'PICKUP' ? 'pickup' : 'dineIn'), style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w700))),
            const Spacer(), Text(money(o.totalMinor, o.currency), style: const TextStyle(fontSize: 17, fontWeight: FontWeight.w800)),
          ]),
          const SizedBox(height: 4),
          Text(o.items.map((i) => '${i.quantity}× ${i.name}').join(', '), maxLines: 2, overflow: TextOverflow.ellipsis, style: const TextStyle(fontSize: 15)),
          const SizedBox(height: 6),
          Text('${o.customerName}  ·  $mins ${tr(l, 'min')} ${tr(l, 'ago')}${o.promisedAt != null ? '  ·  ${tr(l, 'by')} ${TimeOfDay.fromDateTime(o.promisedAt!).format(context)}' : ''}', style: const TextStyle(fontSize: 13, color: Color(0xFF8A5A6E))),
        ])),
      ),
    );
  }
}
