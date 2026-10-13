// An order as the terminal receives it (the "order snapshot" of TERMINAL_PROTOCOL.md).
class OrderItem {
  OrderItem({required this.name, this.variant, required this.quantity, required this.unitMinor, required this.totalMinor, this.notes = '', this.modifiers = const []});
  final String name, notes;
  final String? variant;
  final int quantity, unitMinor, totalMinor;
  final List<String> modifiers;

  factory OrderItem.fromJson(Map<String, dynamic> j) => OrderItem(
        name: '${j['name']}', variant: j['variant'] as String?, quantity: (j['quantity'] as num?)?.toInt() ?? 1,
        unitMinor: (j['unitMinor'] as num?)?.toInt() ?? 0, totalMinor: (j['totalMinor'] as num?)?.toInt() ?? 0, notes: '${j['notes'] ?? ''}',
        modifiers: ((j['modifiers'] as List?) ?? []).map((m) => '${(m as Map)['name']}').toList());
}

enum Stage { fresh, kitchen, ready, out, done }

class Order {
  Order({required this.id, required this.number, required this.status, required this.fulfillment, required this.createdAt, this.prepMinutes, this.promisedAt,
      required this.customerName, required this.customerPhone, this.address, this.mapLink, this.note = '', required this.currency,
      required this.subtotalMinor, required this.discountMinor, required this.deliveryFeeMinor, required this.totalMinor, required this.items, required this.raw});
  final String id, number, status, fulfillment, customerName, customerPhone, currency, note;
  final DateTime createdAt;
  final DateTime? promisedAt;
  final int? prepMinutes;
  final String? address, mapLink;
  final int subtotalMinor, discountMinor, deliveryFeeMinor, totalMinor;
  final List<OrderItem> items;
  final Map<String, dynamic> raw; // the whole snapshot, kept for printing

  bool get isDelivery => fulfillment == 'DELIVERY';
  bool get isNew => status == 'AWAITING_BUSINESS_CONFIRMATION';
  Stage get stage => switch (status) {
        'AWAITING_BUSINESS_CONFIRMATION' => Stage.fresh,
        'ACCEPTED' || 'PREPARING' => Stage.kitchen,
        'READY' => Stage.ready,
        'OUT_FOR_DELIVERY' => Stage.out,
        _ => Stage.done,
      };

  factory Order.fromJson(Map<String, dynamic> j) {
    final a = j['address'] as Map?;
    final address = a == null ? null : [if (a['label'] != null) '${a['label']}:', '${a['text'] ?? ''}', if (a['instructions'] != null) '(${a['instructions']})'].join(' ').trim();
    return Order(
      id: '${j['orderId']}', number: '${j['number']}', status: '${j['status']}', fulfillment: '${j['fulfillment']}',
      createdAt: DateTime.tryParse('${j['createdAt']}')?.toLocal() ?? DateTime.now(), prepMinutes: (j['prepMinutes'] as num?)?.toInt(),
      promisedAt: DateTime.tryParse('${j['promisedAt']}')?.toLocal(),
      customerName: '${(j['customer'] as Map?)?['name'] ?? ''}', customerPhone: '${(j['customer'] as Map?)?['phone'] ?? ''}',
      address: address, mapLink: a?['map'] as String?, note: '${j['note'] ?? ''}', currency: '${j['currency'] ?? 'AED'}',
      subtotalMinor: (j['subtotalMinor'] as num?)?.toInt() ?? 0, discountMinor: (j['discountMinor'] as num?)?.toInt() ?? 0,
      deliveryFeeMinor: (j['deliveryFeeMinor'] as num?)?.toInt() ?? 0, totalMinor: (j['totalMinor'] as num?)?.toInt() ?? 0,
      items: ((j['items'] as List?) ?? []).map((i) => OrderItem.fromJson(Map<String, dynamic>.from(i as Map))).toList(), raw: j);
  }
}

// Money is sent in minor units (fils/baisa); OMR, BHD and KWD have three decimals.
String money(int minor, String currency) {
  final d = const {'OMR', 'BHD', 'KWD'}.contains(currency) ? 3 : 2;
  var p = 1; for (var i = 0; i < d; i++) { p *= 10; }
  final v = minor / p;
  return '${v.toStringAsFixed(v == v.roundToDouble() ? 0 : d)} $currency';
}
