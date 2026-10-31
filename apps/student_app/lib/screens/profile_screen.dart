import 'package:canteen_core/canteen_core.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../state/providers.dart';
import 'profile_setup_screen.dart';

class ProfileScreen extends ConsumerWidget {
  const ProfileScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final user = ref.watch(authProvider).valueOrNull;
    if (user == null) return const SizedBox.shrink();
    return Scaffold(
      appBar: AppBar(title: const Text('Profile')),
      body: ListView(padding: const EdgeInsets.all(16), children: [
        Card(
          child: Padding(
            padding: const EdgeInsets.all(16),
            child: Row(children: [
              CircleAvatar(
                radius: 28,
                backgroundColor: CanteenColors.yellow,
                child: Text((user.name ?? '?').characters.first.toUpperCase(),
                    style: const TextStyle(fontSize: 24, fontWeight: FontWeight.w800, color: CanteenColors.ink)),
              ),
              const SizedBox(width: 14),
              Expanded(
                child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                  Text(user.name ?? '', style: const TextStyle(fontSize: 18, fontWeight: FontWeight.w700)),
                  if ((user.rollNo ?? '').isNotEmpty) Text('Roll no. ${user.rollNo}', style: const TextStyle(color: CanteenColors.muted)),
                  Text(user.phone, style: const TextStyle(color: CanteenColors.muted)),
                ]),
              ),
              IconButton(
                icon: const Icon(Icons.edit_outlined),
                onPressed: () => Navigator.of(context).push(
                  MaterialPageRoute(builder: (_) => const ProfileSetupScreen(editing: true)),
                ),
              ),
            ]),
          ),
        ),
        if (user.isBlocked) ...[
          const SizedBox(height: 12),
          const Card(
            color: Color(0xFFFFEDED),
            child: Padding(
              padding: EdgeInsets.all(14),
              child: Text('Your account is blocked from app orders after uncollected orders. Please speak to the canteen.'),
            ),
          ),
        ],
        const SizedBox(height: 16),
        const Card(
          child: Column(children: [
            ListTile(
              leading: Icon(Icons.storefront_outlined),
              title: Text('How it works'),
              subtitle: Text('Choose food → add to cart → place order → pick up and pay at the counter.'),
            ),
            ListTile(
              leading: Icon(Icons.info_outline),
              title: Text('Collect within 30 minutes of "Ready"'),
              subtitle: Text('Orders not collected are marked as no-show.'),
            ),
          ]),
        ),
        const SizedBox(height: 24),
        OutlinedButton.icon(
          onPressed: () => ref.read(authProvider.notifier).logout(),
          icon: const Icon(Icons.logout),
          label: const Text('Log out'),
        ),
      ]),
    );
  }
}
