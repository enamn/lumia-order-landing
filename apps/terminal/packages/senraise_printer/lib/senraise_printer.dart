import 'package:flutter/services.dart';

/// Thrown when the printer could not do the job. [code] is NOT_BOUND (printing service not available), PRINT_FAILED or BAD_ARGS.
class PrinterException implements Exception {
  PrinterException(this.code, this.message);
  final String code;
  final String? message;
  @override
  String toString() => 'PrinterException($code${message == null ? '' : ': $message'})';
}

/// One step of a print job. A job is sent as a whole and printed in order, so two receipts never mix.
class PrintOp {
  const PrintOp._(this._map);
  final Map<String, Object?> _map;
  factory PrintOp.text(String text) => PrintOp._({'op': 'text', 'text': text});
  /// A PNG (the receipt drawn as a picture: any language, any font). 384 dots wide fits a 58 mm printer.
  factory PrintOp.image(Uint8List png) => PrintOp._({'op': 'pic', 'data': png});
  factory PrintOp.qr(String data, {int size = 6, int level = 1}) => PrintOp._({'op': 'qr', 'data': data, 'size': size, 'level': level});
  factory PrintOp.barcode(String data, {int symbology = 8, int height = 100, int width = 2}) => PrintOp._({'op': 'bar', 'data': data, 'symbology': symbology, 'height': height, 'width': width});
  /// 0 left, 1 centre, 2 right.
  factory PrintOp.align(int value) => PrintOp._({'op': 'align', 'value': value});
  factory PrintOp.textSize(double value) => PrintOp._({'op': 'size', 'value': value});
  factory PrintOp.bold(bool value) => PrintOp._({'op': 'bold', 'value': value});
  factory PrintOp.dark(int value) => PrintOp._({'op': 'dark', 'value': value});
  factory PrintOp.feed(int lines) => PrintOp._({'op': 'line', 'count': lines});
  factory PrintOp.epson(Uint8List bytes) => PrintOp._({'op': 'epson', 'data': bytes});
}

class SenraisePrinter {
  static const _channel = MethodChannel('senraise_printer');

  /// Whether the printing service is connected right now.
  Future<bool> isBound() async => (await _channel.invokeMethod<bool>('bound')) ?? false;

  /// The printing service version, or throws NOT_BOUND.
  Future<String?> version() => _call('version', null);

  /// Prints the steps in order. Completes when they were all sent to the printer, or throws [PrinterException].
  Future<void> print(List<PrintOp> ops) => _call('batch', {'ops': ops.map((o) => o._map).toList()});

  Future<String?> _call(String method, Object? args) async {
    try {
      return await _channel.invokeMethod<String>(method, args).timeout(const Duration(seconds: 20));
    } on PlatformException catch (e) {
      throw PrinterException(e.code, e.message);
    } on Exception {
      throw PrinterException('PRINT_FAILED', 'The printer did not answer.');
    }
  }
}
