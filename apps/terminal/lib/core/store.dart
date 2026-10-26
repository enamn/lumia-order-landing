import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:shared_preferences/shared_preferences.dart';

// What the terminal remembers: its key (encrypted storage) and its settings.
class Session {
  Session({required this.key, required this.deviceId, required this.business, required this.branch, required this.realtime, required this.api});
  final String key, deviceId, realtime, api;
  String business, branch; // the restaurant can rename the branch or move this terminal to another one
}

class Store {
  Store(this._prefs);
  final SharedPreferences _prefs;
  static const _secure = FlutterSecureStorage(aOptions: AndroidOptions());

  static Future<Store> open() async => Store(await SharedPreferences.getInstance());

  Future<Session?> loadSession() async {
    final key = await _secure.read(key: 'key');
    if (key == null) return null;
    return Session(
      key: key, deviceId: _prefs.getString('deviceId') ?? '', business: _prefs.getString('business') ?? '', branch: _prefs.getString('branch') ?? '',
      realtime: _prefs.getString('realtime') ?? '', api: _prefs.getString('api') ?? '');
  }

  Future<void> saveNames(String business, String branch) async { await _prefs.setString('business', business); await _prefs.setString('branch', branch); }

  Future<void> saveSession(Session s) async {
    await _secure.write(key: 'key', value: s.key);
    await _prefs.setString('deviceId', s.deviceId);
    await _prefs.setString('business', s.business);
    await _prefs.setString('branch', s.branch);
    await _prefs.setString('realtime', s.realtime);
    await _prefs.setString('api', s.api);
  }

  Future<void> forget() async {
    await _secure.delete(key: 'key');
    for (final k in ['deviceId', 'business', 'branch', 'realtime', 'api', 'lastEvent']) { await _prefs.remove(k); }
  }

  // A stable serial for this terminal (the real one when Android gives it, otherwise one we make once).
  String? get serial => _prefs.getString('serial');
  Future<void> setSerial(String v) => _prefs.setString('serial', v);

  int get lastEvent => _prefs.getInt('lastEvent') ?? 0;
  Future<void> setLastEvent(int ms) => _prefs.setInt('lastEvent', ms);

  String get lang => _prefs.getString('lang') ?? 'en';
  Future<void> setLang(String v) => _prefs.setString('lang', v);
  bool get autoPrint => _prefs.getBool('autoPrint') ?? true;
  Future<void> setAutoPrint(bool v) => _prefs.setBool('autoPrint', v);
  bool get alarmOn => _prefs.getBool('alarmOn') ?? true;
  Future<void> setAlarmOn(bool v) => _prefs.setBool('alarmOn', v);
}
