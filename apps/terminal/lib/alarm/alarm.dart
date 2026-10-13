import 'package:audioplayers/audioplayers.dart';
import 'package:flutter/services.dart';

// The new-order alarm: loops until nobody is waiting for an answer. Plays on the alarm volume so it is loud even if media is muted.
abstract class Alarm {
  Future<void> setRinging(bool ringing);
  Future<void> dispose();
}

class SoundAlarm implements Alarm {
  final _player = AudioPlayer();
  bool _ringing = false, _ready = false;

  Future<void> _init() async {
    if (_ready) return;
    await _player.setAudioContext(AudioContext(android: const AudioContextAndroid(usageType: AndroidUsageType.alarm, contentType: AndroidContentType.sonification, audioFocus: AndroidAudioFocus.gain, stayAwake: true)));
    await _player.setReleaseMode(ReleaseMode.loop);
    await _player.setVolume(1);
    _ready = true;
  }

  @override
  Future<void> setRinging(bool ringing) async {
    if (ringing == _ringing) return;
    _ringing = ringing;
    try {
      if (ringing) {
        await _init();
        await _player.play(AssetSource('alarm.wav'));
        HapticFeedback.vibrate();
      } else {
        await _player.stop();
      }
    } catch (_) { /* no sound is better than a crash; the card still shows */ }
  }

  @override
  Future<void> dispose() => _player.dispose();
}
