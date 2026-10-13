import '../orders/order.dart';

class PrintResult {
  const PrintResult.ok() : ok = true, reason = null;
  const PrintResult.fail(this.reason) : ok = false;
  final bool ok;
  final String? reason; // PAPER_OUT | OFFLINE | OTHER (TERMINAL_PROTOCOL.md)
}

// The built-in thermal printer. The real one (Senraise service) comes with the printing step; until then nothing prints.
abstract class ReceiptPrinter {
  Future<PrintResult> printOrder(Order order, {required String lang});
  Future<PrintResult> printTest({required String lang});
}

class NoPrinter implements ReceiptPrinter {
  @override
  Future<PrintResult> printOrder(Order order, {required String lang}) async => const PrintResult.fail('OTHER');
  @override
  Future<PrintResult> printTest({required String lang}) async => const PrintResult.fail('OTHER');
}
