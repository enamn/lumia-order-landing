// Where the Lumia Order app lives. Overridable at build time for testing:
//   flutter run --dart-define=LUMIA_APP=http://192.168.1.20:3000
const defaultApp = String.fromEnvironment('LUMIA_APP', defaultValue: 'https://app.order.lumia.ae');
const appVersion = '0.1.0';
