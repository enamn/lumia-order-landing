import 'dart:convert';
import 'package:http/http.dart' as http;

class ApiError implements Exception {
  ApiError(this.status, this.code, this.message);
  final int status;
  final String code, message;
  bool get unauthorized => status == 401;
  @override
  String toString() => message;
}

class Pairing {
  Pairing({required this.deviceId, required this.key, required this.business, required this.branch, required this.realtime, required this.api});
  final String deviceId, key, business, branch, realtime, api;
}

// The terminal's calls to the Lumia Order app. Pairing has no sign-in (the code is the proof); everything else carries the terminal's own key.
class Api {
  Api({required this.base, this.key, http.Client? client}) : _http = client ?? http.Client();
  final String base;
  final String? key;
  final http.Client _http;

  Map<String, String> get _headers => {'content-type': 'application/json', if (key != null) 'authorization': 'Bearer $key'};

  Future<dynamic> _send(Future<http.Response> Function() call) async {
    http.Response r;
    try {
      r = await call().timeout(const Duration(seconds: 15));
    } catch (_) {
      throw ApiError(0, 'OFFLINE', 'No connection. Check the internet.');
    }
    Map<String, dynamic> body = {};
    try { body = jsonDecode(utf8.decode(r.bodyBytes)) as Map<String, dynamic>; } catch (_) {}
    if (r.statusCode >= 200 && r.statusCode < 300) return body['data'];
    final e = (body['error'] as Map?) ?? {};
    throw ApiError(r.statusCode, '${e['code'] ?? 'ERROR'}', '${e['message'] ?? 'Something went wrong.'}');
  }

  Future<Pairing> pair({required String code, required String serial, required String model, String? name}) async {
    final d = await _send(() => _http.post(Uri.parse('$base/api/public/devices/pair'), headers: _headers,
        body: jsonEncode({'code': code, 'serial': serial, 'model': model, 'appVersion': '0.1.0', 'name': ?name}))) as Map;
    return Pairing(
      deviceId: d['deviceId'], key: d['key'], business: d['business']['name'], branch: d['branch']['name'],
      realtime: d['realtime'], api: (d['api'] as String?) ?? base);
  }

  Future<List<Map<String, dynamic>>> openOrders() async {
    final d = await _send(() => _http.get(Uri.parse('$base/api/device/orders'), headers: _headers)) as List;
    return d.cast<Map<String, dynamic>>();
  }

  Future<void> setStatus(String orderId, String status, {int? prepMinutes, String? reason}) async {
    await _send(() => _http.post(Uri.parse('$base/api/device/orders/$orderId/status'), headers: _headers,
        body: jsonEncode({'status': status, 'prepMinutes': ?prepMinutes, if (reason != null && reason.isNotEmpty) 'reason': reason})));
  }
}
