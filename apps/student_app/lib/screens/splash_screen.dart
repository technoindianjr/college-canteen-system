import 'package:canteen_core/canteen_core.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../state/providers.dart';
import 'login_screen.dart';

/// Shown while the saved session is checked; offers Retry if the server can't be reached.
class SplashScreen extends ConsumerWidget {
  const SplashScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final auth = ref.watch(authProvider);
    return Scaffold(
      body: Center(
        child: Padding(
          padding: const EdgeInsets.all(32),
          child: Column(mainAxisSize: MainAxisSize.min, children: [
            const BrandHeader(),
            const SizedBox(height: 32),
            if (auth.hasError) ...[
              Text(auth.error.toString(), textAlign: TextAlign.center, style: const TextStyle(color: CanteenColors.muted)),
              const SizedBox(height: 16),
              FilledButton(onPressed: () => ref.invalidate(authProvider), child: const Text('Retry')),
            ] else
              const CircularProgressIndicator(),
          ]),
        ),
      ),
    );
  }
}
