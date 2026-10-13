import 'package:senraise_printer/senraise_printer.dart';
import '../orders/order.dart';
import 'printer.dart';
import 'receipt_image.dart';

// Prints on the terminal's built-in printer: the receipt is drawn as a picture and sent in one job.
// The printing service gives no paper or cover status, so a job counts as printed once it was handed to the printer without an error.
class SenraiseReceiptPrinter implements ReceiptPrinter {
  SenraiseReceiptPrinter({SenraisePrinter? printer}) : _printer = printer ?? SenraisePrinter();
  final SenraisePrinter _printer;

  Future<PrintResult> _send(List<PrintOp> ops) async {
    try {
      await _printer.print(ops);
      return const PrintResult.ok();
    } on PrinterException catch (e) {
      return PrintResult.fail(e.code == 'NOT_BOUND' ? 'OFFLINE' : 'OTHER');
    } catch (_) {
      return const PrintResult.fail('OTHER');
    }
  }

  @override
  Future<PrintResult> printOrder(Order order, {required String lang}) async {
    final png = await renderReceipt(order, lang: lang);
    final map = order.mapLink;
    return _send([PrintOp.align(1), PrintOp.image(png), if (order.isDelivery && map != null) ...[PrintOp.qr(map, size: 5), PrintOp.feed(1)], PrintOp.feed(4)]);
  }

  @override
  Future<PrintResult> printTest({required String lang}) async =>
      _send([PrintOp.align(1), PrintOp.image(await renderTestReceipt(lang: lang)), PrintOp.feed(4)]);
}
