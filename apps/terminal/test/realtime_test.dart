import 'dart:async';
import 'dart:convert';
import 'dart:io';
import 'package:flutter_test/flutter_test.dart';
import 'package:lumia_terminal/core/realtime.dart';

void main() {
  test('connects with the key, acknowledges events, ignores repeats, remembers the time, reconnects with since, and stops on 4403', () async {
    final server = await HttpServer.bind('127.0.0.1', 0);
    final auth = <String?>[], sinces = <String?>[], got = <Map<String, dynamic>>[]; var sockets = 0;
    server.listen((req) async {
      final ws = await WebSocketTransformer.upgrade(req); sockets++;
      auth.add(req.headers.value('authorization')); sinces.add(req.uri.queryParameters['since']);
      ws.listen((m) => got.add(jsonDecode(m as String)));
      ws.add(jsonEncode({'type': 'hello'}));
      final ev = jsonEncode({'type': 'event', 'id': 'e1', 'event': 'order.new', 'payload': {'orderId': 'o1'}, 'at': '2026-10-13T10:00:00.000Z'});
      ws.add(ev); ws.add(ev); // the same event twice (a replay)
      if (sockets == 1) Timer(const Duration(milliseconds: 300), () => ws.close(4000, 'drop'));
      if (sockets == 2) Timer(const Duration(milliseconds: 300), () => ws.close(4403, 'revoked'));
    });
    final events = <String>[]; var saved = 0, revoked = false; final states = <bool>[];
    final rt = Realtime(url: 'ws://127.0.0.1:${server.port}/ws/device', key: 'lumd_k', version: '1', since: 0, saveSince: (v) => saved = v,
        onEvent: (id, e, p, at) => events.add('$id:$e'), onState: states.add, onRevoked: () => revoked = true)..start();
    final until = DateTime.now().add(const Duration(seconds: 10));
    while (!revoked && DateTime.now().isBefore(until)) { await Future.delayed(const Duration(milliseconds: 50)); }
    expect(revoked, true);
    expect(auth.toSet(), {'Bearer lumd_k'});
    expect(events, ['e1:order.new']); // delivered once, though the server sent it twice and again after the reconnect (de-duplicated by event id)
    expect(got.where((m) => m['type'] == 'ack').length, 4); // every delivery is still acknowledged
    expect(saved, DateTime.parse('2026-10-13T10:00:00Z').millisecondsSinceEpoch);
    expect(sinces.first, null); expect(sinces.last, '$saved');
    expect(states, containsAllInOrder([true, false, true, false]));
    rt.stop(); await server.close(force: true);
  });
}
