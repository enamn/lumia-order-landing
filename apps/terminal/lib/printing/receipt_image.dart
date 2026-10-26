import 'dart:typed_data';
import 'dart:ui' as ui;
import 'package:flutter/painting.dart';
import '../orders/order.dart';

// The receipt drawn as a picture, so any language and any dish name prints correctly (the printer only needs to print a picture).
// 384 dots is the width of a 58 mm printer.
const receiptWidth = 384.0;

/// Only tests set this (the test environment draws letters as blocks unless a real font is named).
String? receiptFontFamily;

const _ink = Color(0xFF000000);
TextStyle _s(double size, {bool bold = false, bool italic = false}) => TextStyle(fontFamily: receiptFontFamily, fontFamilyFallback: const ['DirhamSign', 'Riyal'], color: _ink, fontSize: size, height: 1.25, fontWeight: bold ? FontWeight.w800 : FontWeight.w500, fontStyle: italic ? FontStyle.italic : FontStyle.normal);

class _Row {
  _Row(this.height, this.paint);
  final double height;
  final void Function(Canvas c, double y) paint;
}

class _Sheet {
  _Sheet({required this.rtl});
  final bool rtl;
  final double width = receiptWidth;
  final rows = <_Row>[];
  TextDirection get dir => rtl ? TextDirection.rtl : TextDirection.ltr;

  TextPainter _tp(String text, TextStyle style, {double? maxWidth, TextAlign? align}) =>
      TextPainter(text: TextSpan(text: text, style: style), textDirection: dir, textAlign: align ?? TextAlign.start)..layout(maxWidth: maxWidth ?? width);

  void center(String text, TextStyle style) {
    final p = _tp(text, style, align: TextAlign.center);
    rows.add(_Row(p.height, (c, y) => p.paint(c, Offset((width - p.width) / 2, y))));
  }

  void line(String text, TextStyle style, {double indent = 0}) {
    final p = _tp(text, style, maxWidth: width - indent);
    rows.add(_Row(p.height, (c, y) => p.paint(c, Offset(rtl ? width - indent - p.width : indent, y))));
  }

  // label on the start side, value on the end side; a long label wraps and the value stays on its first line.
  void pair(String label, String value, TextStyle style, {double indent = 0}) {
    final v = _tp(value, style), l = _tp(label, style, maxWidth: width - indent - v.width - 10);
    rows.add(_Row(l.height > v.height ? l.height : v.height, (c, y) {
      if (rtl) { l.paint(c, Offset(width - indent - l.width, y)); v.paint(c, Offset(0, y)); } else { l.paint(c, Offset(indent, y)); v.paint(c, Offset(width - v.width, y)); }
    }));
  }

  void divider({bool dashed = true}) => rows.add(_Row(10, (c, y) {
        final paint = Paint()..color = _ink..strokeWidth = 1.5;
        if (!dashed) { c.drawLine(Offset(0, y + 5), Offset(width, y + 5), paint); return; }
        for (var x = 0.0; x < width; x += 8) { c.drawLine(Offset(x, y + 5), Offset(x + 4, y + 5), paint); }
      }));

  void gap(double h) => rows.add(_Row(h, (_, _) {}));

  Future<Uint8List> png() async {
    final h = rows.fold<double>(0, (a, r) => a + r.height) + 8;
    final rec = ui.PictureRecorder(), canvas = Canvas(rec, Rect.fromLTWH(0, 0, width, h));
    canvas.drawRect(Rect.fromLTWH(0, 0, width, h), Paint()..color = const Color(0xFFFFFFFF));
    var y = 4.0;
    for (final r in rows) { r.paint(canvas, y); y += r.height; }
    final img = await rec.endRecording().toImage(width.toInt(), h.ceil());
    final data = await img.toByteData(format: ui.ImageByteFormat.png);
    return data!.buffer.asUint8List();
  }
}

String _time(DateTime t) => '${t.day.toString().padLeft(2, '0')}/${t.month.toString().padLeft(2, '0')} ${t.hour.toString().padLeft(2, '0')}:${t.minute.toString().padLeft(2, '0')}';

const _words = {
  'delivery': ['DELIVERY', 'توصيل'], 'pickup': ['PICKUP', 'استلام'], 'dineIn': ['DINE IN', 'في المطعم'], 'order': ['Order', 'طلب'],
  'customer': ['Customer', 'العميل'], 'subtotal': ['Subtotal', 'المجموع الفرعي'], 'discount': ['Discount', 'الخصم'], 'fee': ['Delivery fee', 'رسوم التوصيل'],
  'tax': ['VAT', 'الضريبة'], 'total': ['TOTAL', 'الإجمالي'], 'note': ['Note', 'ملاحظة'], 'ready': ['Ready by', 'جاهز عند'], 'trn': ['TRN', 'الرقم الضريبي'],
  'thanks': ['Thank you!', 'شكراً لكم!'], 'test': ['TEST PRINT', 'طباعة تجريبية'], 'printerOk': ['The printer works.', 'الطابعة تعمل.'],
};
String _w(String lang, String k) => _words[k]![lang == 'ar' ? 1 : 0];

Future<Uint8List> renderReceipt(Order o, {required String lang}) {
  final raw = o.raw, business = (raw['business'] as Map?) ?? {}, branch = (raw['branch'] as Map?) ?? {};
  final sh = _Sheet(rtl: lang == 'ar'), cur = o.currency;
  sh.center('${business['name'] ?? ''}', _s(26, bold: true));
  if ('${branch['name'] ?? ''}'.isNotEmpty) sh.center('${branch['name']}', _s(20));
  if (branch['phone'] != null) sh.center('${branch['phone']}', _s(18));
  if (business['trn'] != null) sh.center('${_w(lang, 'trn')}: ${business['trn']}', _s(18));
  sh.gap(8); sh.divider(dashed: false);
  sh.center('${_w(lang, 'order')} #${o.number}', _s(34, bold: true));
  sh.center(_w(lang, o.isDelivery ? 'delivery' : o.fulfillment == 'PICKUP' ? 'pickup' : 'dineIn'), _s(26, bold: true));
  sh.center(_time(o.createdAt), _s(18));
  if (o.promisedAt != null) sh.center('${_w(lang, 'ready')} ${_time(o.promisedAt!).substring(6)}', _s(22, bold: true));
  sh.divider();
  sh.line('${_w(lang, 'customer')}: ${o.customerName}', _s(20, bold: true));
  if (o.customerPhone.isNotEmpty) sh.line(o.customerPhone, _s(20));
  if (o.isDelivery && (o.address ?? '').isNotEmpty) sh.line(o.address!, _s(20));
  sh.divider();
  for (final i in o.items) {
    sh.pair('${i.quantity}×  ${i.name}${i.variant != null ? ' (${i.variant})' : ''}', amountText(i.totalMinor, cur), _s(22, bold: true));
    for (final m in i.modifiers) { sh.line('+ $m', _s(18), indent: 24); }
    if (i.notes.isNotEmpty) sh.line(i.notes, _s(18, italic: true), indent: 24);
    sh.gap(4);
  }
  sh.divider();
  sh.pair(_w(lang, 'subtotal'), money(o.subtotalMinor, cur), _s(20));
  if (o.discountMinor > 0) sh.pair(_w(lang, 'discount'), '- ${money(o.discountMinor, cur)}', _s(20));
  if (o.deliveryFeeMinor > 0) sh.pair(_w(lang, 'fee'), money(o.deliveryFeeMinor, cur), _s(20));
  final tax = (raw['taxMinor'] as num?)?.toInt() ?? 0;
  if (tax > 0) sh.pair(_w(lang, 'tax'), money(tax, cur), _s(20));
  sh.gap(4); sh.pair(_w(lang, 'total'), money(o.totalMinor, cur), _s(30, bold: true));
  if (o.note.isNotEmpty) { sh.divider(); sh.line('${_w(lang, 'note')}: ${o.note}', _s(20, bold: true)); }
  sh.divider(); sh.center(_w(lang, 'thanks'), _s(20)); sh.gap(6);
  return sh.png();
}

Future<Uint8List> renderTestReceipt({required String lang, String branch = ''}) {
  final sh = _Sheet(rtl: lang == 'ar');
  sh.center('Lumia Order', _s(30, bold: true));
  sh.center(_w(lang, 'test'), _s(26, bold: true));
  if (branch.isNotEmpty) sh.center(branch, _s(20));
  sh.center(_time(DateTime.now()), _s(18));
  sh.divider(); sh.center(_w(lang, 'printerOk'), _s(22)); sh.gap(6);
  return sh.png();
}
