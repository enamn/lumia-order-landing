import 'dart:io';
import 'package:flutter_foreground_task/flutter_foreground_task.dart';

// Keeps the terminal alive all day (Android 13): a foreground service with its notification keeps the app's process, the live connection and the
// alarm running when the screen is off or another screen is shown, holds a Wi-Fi lock and a wake lock, and starts again after a reboot or an app update.
// A watchdog inside the service checks that the app screen process still answers, and brings the app back if it does not.

@pragma('vm:entry-point')
void backgroundCallback() => FlutterForegroundTask.setTaskHandler(KeepAliveHandler());

class KeepAliveHandler extends TaskHandler {
  DateTime _lastAnswer = DateTime.now();

  @override
  Future<void> onStart(DateTime timestamp, TaskStarter starter) async { _lastAnswer = DateTime.now(); }

  @override
  void onRepeatEvent(DateTime timestamp) {
    FlutterForegroundTask.sendDataToMain('ping');
    // No answer for 90 s: the app's screen process is gone (or hung). Open the app again; it reconnects and loads the open orders.
    if (DateTime.now().difference(_lastAnswer).inSeconds > 90) {
      _lastAnswer = DateTime.now(); // try again in another 90 s, not every tick
      FlutterForegroundTask.launchApp();
    }
  }

  @override
  void onReceiveData(Object data) { if (data == 'pong') _lastAnswer = DateTime.now(); }

  @override
  Future<void> onDestroy(DateTime timestamp, bool isTimeout) async {}
}

class Background {
  static bool _ready = false;

  // Call once at start-up (before runApp).
  static void init() {
    FlutterForegroundTask.initCommunicationPort();
    FlutterForegroundTask.addTaskDataCallback((data) { if (data == 'ping') FlutterForegroundTask.sendDataToTask('pong'); });
    FlutterForegroundTask.init(
      androidNotificationOptions: AndroidNotificationOptions(
        channelId: 'lumia_terminal', channelName: 'Lumia Order terminal', channelDescription: 'Shows that the terminal is connected and ready for orders.',
        channelImportance: NotificationChannelImportance.LOW, priority: NotificationPriority.LOW, onlyAlertOnce: true,
      ),
      iosNotificationOptions: const IOSNotificationOptions(showNotification: false, playSound: false),
      foregroundTaskOptions: ForegroundTaskOptions(
        eventAction: ForegroundTaskEventAction.repeat(15000), autoRunOnBoot: true, autoRunOnMyPackageReplaced: true, allowWakeLock: true, allowWifiLock: true,
      ),
    );
    _ready = true;
  }

  // The three things Android 13 needs from the user, asked one after another (each opens a system screen): notifications (the service must show one),
  // no battery restriction (so it is not stopped to save power), and showing over other apps (so the watchdog can bring the app back).
  static Future<void> askPermissions() async {
    if (!Platform.isAndroid) return;
    if (await FlutterForegroundTask.checkNotificationPermission() != NotificationPermission.granted) await FlutterForegroundTask.requestNotificationPermission();
    if (!await FlutterForegroundTask.isIgnoringBatteryOptimizations) await FlutterForegroundTask.requestIgnoreBatteryOptimization();
    if (!await FlutterForegroundTask.canDrawOverlays) await FlutterForegroundTask.openSystemAlertWindowSettings();
  }

  static Future<void> start({required String title, required String text}) async {
    if (!_ready || !Platform.isAndroid) return;
    if (await FlutterForegroundTask.isRunningService) {
      await FlutterForegroundTask.updateService(notificationTitle: title, notificationText: text);
    } else {
      await FlutterForegroundTask.startService(
        serviceId: 256, serviceTypes: [ForegroundServiceTypes.remoteMessaging], notificationTitle: title, notificationText: text, callback: backgroundCallback);
    }
  }

  static Future<void> update({required String title, required String text}) async {
    if (!_ready || !Platform.isAndroid) return;
    if (await FlutterForegroundTask.isRunningService) await FlutterForegroundTask.updateService(notificationTitle: title, notificationText: text);
  }

  static Future<void> stop() async {
    if (!_ready || !Platform.isAndroid) return;
    if (await FlutterForegroundTask.isRunningService) await FlutterForegroundTask.stopService();
  }
}
