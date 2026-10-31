import 'package:canteen_core/canteen_core.dart';
import 'package:firebase_messaging/firebase_messaging.dart';
import 'package:flutter/material.dart';

/// Registers this phone for "your order is ready" push notifications.
/// Skipped in dev-login mode (no Firebase).
class PushService {
  PushService(this.api, this.messengerKey);

  final ApiClient api;
  final GlobalKey<ScaffoldMessengerState> messengerKey;
  bool _started = false;

  Future<void> start() async {
    if (AppConfig.devLogin || _started) return;
    _started = true;
    try {
      final fm = FirebaseMessaging.instance;
      await fm.requestPermission(alert: true, badge: true, sound: true);
      final token = await fm.getToken();
      if (token != null) await api.updateProfile(fcmToken: token);
      fm.onTokenRefresh.listen((t) => api.updateProfile(fcmToken: t));

      // While the app is open, show the push as a banner (the order screen also updates live).
      FirebaseMessaging.onMessage.listen((msg) {
        final n = msg.notification;
        if (n == null) return;
        messengerKey.currentState?.showSnackBar(
          SnackBar(content: Text([n.title, n.body].whereType<String>().join('\n'))),
        );
      });
    } catch (e) {
      debugPrint('Push setup failed: $e');
    }
  }
}
