/// Server address. Pass it at build time:
///   flutter run --dart-define=API_URL=https://api.your-domain.com
/// Defaults to the Android emulator's view of your Mac's localhost.
class AppConfig {
  static const apiUrl = String.fromEnvironment('API_URL', defaultValue: 'http://10.0.2.2:3000');

  /// When true, the OTP screen accepts any 6 digits and logs in with a "dev:+91..." token.
  /// Only works while the server has AUTH_DEV_MODE=true. Never ship a release build with it.
  static const devLogin = bool.fromEnvironment('DEV_LOGIN', defaultValue: false);

  static String get apiBase => '$apiUrl/api/v1';

  /// Turns a server path like /uploads/abc.jpg into a full URL.
  static String? absolute(String? path) {
    if (path == null || path.isEmpty) return null;
    if (path.startsWith('http')) return path;
    return '$apiUrl$path';
  }
}
