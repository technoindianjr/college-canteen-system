import 'package:canteen_core/canteen_core.dart';
import 'package:firebase_core/firebase_core.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'firebase_options.dart';
import 'router.dart';
import 'services/push.dart';
import 'state/providers.dart';

final messengerKey = GlobalKey<ScaffoldMessengerState>();

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();
  if (!AppConfig.devLogin) {
    await Firebase.initializeApp(options: DefaultFirebaseOptions.currentPlatform);
  }
  runApp(const ProviderScope(child: CampusCanteenApp()));
}

class CampusCanteenApp extends ConsumerStatefulWidget {
  const CampusCanteenApp({super.key});

  @override
  ConsumerState<CampusCanteenApp> createState() => _CampusCanteenAppState();
}

class _CampusCanteenAppState extends ConsumerState<CampusCanteenApp> {
  late final PushService _push = PushService(ref.read(apiProvider), messengerKey);

  @override
  void initState() {
    super.initState();
    // Live updates from the server
    final rt = ref.read(realtimeProvider);
    rt.onOrderUpdated = (order) => ref.read(ordersProvider.notifier).upsert(order);
    rt.onMenuChanged = () => ref.invalidate(menuProvider);
    rt.onSettingsChanged = (_) => ref.invalidate(menuProvider);
    rt.onConnectionChanged = (connected) {
      // Catch up on anything missed while the socket was down
      if (connected && ref.read(authProvider).valueOrNull != null) ref.invalidate(ordersProvider);
    };
  }

  @override
  Widget build(BuildContext context) {
    ref.listen(authProvider, (prev, next) {
      final user = next.valueOrNull;
      if (user != null && user.profileComplete) _push.start();
    });
    final router = ref.watch(routerProvider);
    return MaterialApp.router(
      title: 'Campus Canteen',
      debugShowCheckedModeBanner: false,
      theme: canteenTheme(),
      scaffoldMessengerKey: messengerKey,
      routerConfig: router,
    );
  }
}
