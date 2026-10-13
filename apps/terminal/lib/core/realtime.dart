import 'dart:async';
import 'dart:convert';
import 'dart:io';
import 'dart:math';
import 'package:web_socket_channel/io.dart';

typedef EventHandler = void Function(String id, String event, Map<String, dynamic> payload, int atMs);

// The live connection (TERMINAL_PROTOCOL.md section 2): stays open, answers pings, reconnects with backoff and asks for what it missed.
class Realtime {
  Realtime({required this.url, required this.key, required this.onEvent, required this.onState, required this.onRevoked, required this.since, required this.saveSince, required this.version});
  final String url, key, version;
  final EventHandler onEvent;
  final void Function(bool connected) onState;
  final void Function() onRevoked;
  final int since;
  final void Function(int ms) saveSince;

  IOWebSocketChannel? _ch;
  Timer? _ping, _retry, _watchdog;
  int _delay = 1000, _last = 0;
  DateTime _heard = DateTime.now();
  bool _stopped = false, connected = false;
  final _seen = <String>[];
  final _rng = Random();

  void start() { _last = since; _connect(); }

  void _connect() {
    if (_stopped) return;
    final uri = Uri.parse(url).replace(queryParameters: {if (_last > 0) 'since': '$_last'});
    final ch = IOWebSocketChannel.connect(uri, headers: {'authorization': 'Bearer $key'}, pingInterval: null, connectTimeout: const Duration(seconds: 15));
    _ch = ch;
    ch.stream.listen((raw) {
      _heard = DateTime.now();
      Map<String, dynamic> m;
      try { m = jsonDecode(raw as String) as Map<String, dynamic>; } catch (_) { return; }
      switch (m['type']) {
        case 'hello':
          _delay = 1000; _setConnected(true); _startPing();
        case 'event':
          final id = m['id'] as String;
          _send({'type': 'ack', 'id': id});
          if (_seen.contains(id)) return; // replays can repeat what we already have
          _seen.add(id); if (_seen.length > 500) _seen.removeAt(0);
          final at = DateTime.tryParse('${m['at']}')?.millisecondsSinceEpoch ?? DateTime.now().millisecondsSinceEpoch;
          if (at > _last) { _last = at; saveSince(at); }
          onEvent(id, m['event'] as String, Map<String, dynamic>.from(m['payload'] as Map? ?? {}), at);
      }
    }, onDone: () => _dropped(ch.closeCode), onError: (_) => _dropped(null), cancelOnError: true);
  }

  void _startPing() {
    _ping?.cancel(); _watchdog?.cancel();
    _ping = Timer.periodic(const Duration(seconds: 30), (_) => _send({'type': 'ping', 'appVersion': version}));
    // The network can die without the socket noticing: silence for 75 s means it is gone.
    _watchdog = Timer.periodic(const Duration(seconds: 15), (_) { if (DateTime.now().difference(_heard).inSeconds > 75) _ch?.sink.close(WebSocketStatus.goingAway); });
    _send({'type': 'ping', 'appVersion': version});
  }

  void _dropped(int? code) {
    _ping?.cancel(); _watchdog?.cancel(); _setConnected(false);
    if (_stopped) return;
    if (code == 4403) { stop(); onRevoked(); return; } // disconnected from the dashboard: forget the key
    final wait = code == 4409 ? 6000 : _delay + _rng.nextInt(1000);
    _delay = min(_delay * 2, 30000);
    _retry = Timer(Duration(milliseconds: wait), _connect);
  }

  void _setConnected(bool v) { if (connected != v) { connected = v; onState(v); } }

  void _send(Map<String, dynamic> m) { try { _ch?.sink.add(jsonEncode(m)); } catch (_) {} }
  void send(Map<String, dynamic> m) => _send(m);

  // Called when the app comes back or the network returns: do not wait for the backoff.
  void reconnectNow() { if (_stopped || connected) return; _retry?.cancel(); _delay = 1000; _ch?.sink.close(); _connect(); }

  void stop() { _stopped = true; _ping?.cancel(); _retry?.cancel(); _watchdog?.cancel(); _ch?.sink.close(); _setConnected(false); }
}
