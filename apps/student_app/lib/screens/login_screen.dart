import 'package:canteen_core/canteen_core.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:go_router/go_router.dart';

/// Chef hat + fork and knife, "Campus Canteen", "Good Food • Better Days" — the chart's welcome screen.
class BrandHeader extends StatelessWidget {
  const BrandHeader({super.key});

  @override
  Widget build(BuildContext context) {
    return Column(mainAxisSize: MainAxisSize.min, children: [
      Container(
        width: 96,
        height: 96,
        decoration: const BoxDecoration(color: CanteenColors.yellow, shape: BoxShape.circle),
        child: const Icon(Icons.restaurant_menu, size: 48, color: CanteenColors.ink),
      ),
      const SizedBox(height: 16),
      const Text('Campus Canteen', style: TextStyle(fontSize: 30, fontWeight: FontWeight.w800, color: CanteenColors.ink)),
      const SizedBox(height: 4),
      const Text('Good Food • Better Days', style: TextStyle(fontSize: 16, color: CanteenColors.muted)),
    ]);
  }
}

class LoginScreen extends StatefulWidget {
  const LoginScreen({super.key});

  @override
  State<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends State<LoginScreen> {
  final _phone = TextEditingController();
  String? _error;

  @override
  void dispose() {
    _phone.dispose();
    super.dispose();
  }

  void _continue() {
    final digits = _phone.text.replaceAll(RegExp(r'\D'), '');
    if (!RegExp(r'^[6-9]\d{9}$').hasMatch(digits)) {
      setState(() => _error = 'Enter your 10-digit mobile number');
      return;
    }
    context.push('/otp', extra: '+91$digits');
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: SafeArea(
        child: Center(
          child: SingleChildScrollView(
            padding: const EdgeInsets.all(24),
            child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
              const BrandHeader(),
              const SizedBox(height: 40),
              const Text('Log in or sign up', style: TextStyle(fontSize: 18, fontWeight: FontWeight.w700)),
              const SizedBox(height: 4),
              const Text("We'll send a 6-digit code to your mobile.", style: TextStyle(color: CanteenColors.muted)),
              const SizedBox(height: 16),
              TextField(
                controller: _phone,
                keyboardType: TextInputType.phone,
                autofillHints: const [AutofillHints.telephoneNumberNational],
                inputFormatters: [FilteringTextInputFormatter.digitsOnly, LengthLimitingTextInputFormatter(10)],
                decoration: InputDecoration(
                  prefixText: '+91  ',
                  hintText: 'Mobile number',
                  errorText: _error,
                ),
                onChanged: (_) => setState(() => _error = null),
                onSubmitted: (_) => _continue(),
              ),
              const SizedBox(height: 16),
              FilledButton(onPressed: _continue, child: const Text('Send OTP')),
              if (AppConfig.devLogin) ...[
                const SizedBox(height: 12),
                const Text('Dev mode: any 6-digit code works', textAlign: TextAlign.center, style: TextStyle(color: CanteenColors.danger)),
              ],
            ]),
          ),
        ),
      ),
    );
  }
}
