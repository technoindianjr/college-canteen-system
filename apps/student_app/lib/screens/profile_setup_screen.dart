import 'package:canteen_core/canteen_core.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../state/providers.dart';

/// First login: name (required for the counter) and roll number.
class ProfileSetupScreen extends ConsumerStatefulWidget {
  const ProfileSetupScreen({super.key, this.editing = false});

  /// true when opened from Profile → Edit instead of first login.
  final bool editing;

  @override
  ConsumerState<ProfileSetupScreen> createState() => _ProfileSetupScreenState();
}

class _ProfileSetupScreenState extends ConsumerState<ProfileSetupScreen> {
  late final _name = TextEditingController(text: ref.read(authProvider).valueOrNull?.name ?? '');
  late final _roll = TextEditingController(text: ref.read(authProvider).valueOrNull?.rollNo ?? '');
  String? _error;
  bool _busy = false;

  @override
  void dispose() {
    _name.dispose();
    _roll.dispose();
    super.dispose();
  }

  Future<void> _save() async {
    final name = _name.text.trim();
    if (name.length < 2) {
      setState(() => _error = 'Enter your name');
      return;
    }
    setState(() {
      _busy = true;
      _error = null;
    });
    try {
      await ref.read(authProvider.notifier).updateProfile(name: name, rollNo: _roll.text.trim());
      if (widget.editing && mounted) Navigator.of(context).pop();
    } on ApiException catch (e) {
      setState(() => _error = e.message);
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: Text(widget.editing ? 'Edit profile' : 'Welcome!'),
        actions: [
          if (!widget.editing)
            TextButton(onPressed: () => ref.read(authProvider.notifier).logout(), child: const Text('Log out')),
        ],
      ),
      body: SafeArea(
        child: ListView(padding: const EdgeInsets.all(24), children: [
          if (!widget.editing) ...[
            const Text('Tell us who you are', style: TextStyle(fontSize: 22, fontWeight: FontWeight.w800)),
            const SizedBox(height: 4),
            const Text('Staff call out your name when your order is ready.', style: TextStyle(color: CanteenColors.muted)),
            const SizedBox(height: 24),
          ],
          TextField(
            controller: _name,
            textCapitalization: TextCapitalization.words,
            decoration: const InputDecoration(labelText: 'Your name'),
          ),
          const SizedBox(height: 12),
          TextField(
            controller: _roll,
            textCapitalization: TextCapitalization.characters,
            decoration: const InputDecoration(labelText: 'Roll number (optional)'),
          ),
          if (_error != null) ...[
            const SizedBox(height: 12),
            Text(_error!, style: const TextStyle(color: CanteenColors.danger)),
          ],
          const SizedBox(height: 24),
          FilledButton(onPressed: _busy ? null : _save, child: Text(widget.editing ? 'Save' : 'Start ordering')),
        ]),
      ),
    );
  }
}
