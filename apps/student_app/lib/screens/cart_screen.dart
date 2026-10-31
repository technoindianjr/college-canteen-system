import 'package:canteen_core/canteen_core.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../state/providers.dart';
import '../widgets/qty_stepper.dart';

/// "Your Cart" from the chart: items, total, Place order. v1 is pay at the counter.
class CartScreen extends ConsumerStatefulWidget {
  const CartScreen({super.key});

  @override
  ConsumerState<CartScreen> createState() => _CartScreenState();
}

class _CartScreenState extends ConsumerState<CartScreen> {
  final _note = TextEditingController();
  bool _busy = false;

  @override
  void dispose() {
    _note.dispose();
    super.dispose();
  }

  /// Uses the live menu to flag anything that sold out after it was added.
  bool _soldOut(MenuData? m, CartEntry e) {
    if (m == null) return false;
    if (e.menuItemId != null) return !(m.itemById(e.menuItemId!)?.isAvailable ?? false);
    return !(m.comboById(e.comboId!)?.isAvailable ?? false);
  }

  Future<void> _place() async {
    final cart = ref.read(cartProvider);
    setState(() => _busy = true);
    try {
      final order = await ref.read(ordersProvider.notifier).place(cart, note: _note.text);
      ref.read(cartProvider.notifier).clear();
      if (mounted) context.pushReplacement('/order/${order.id}');
    } on ApiException catch (e) {
      if (e.code == 'sold_out' || e.code == 'item_not_found') ref.invalidate(menuProvider);
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(e.message)));
      }
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final cart = ref.watch(cartProvider);
    final total = ref.watch(cartTotalProvider);
    final menu = ref.watch(menuProvider).valueOrNull;
    final notifier = ref.read(cartProvider.notifier);
    final anySoldOut = cart.any((e) => _soldOut(menu, e));
    final isOpen = menu?.ordering.isOpen ?? true;

    return Scaffold(
      appBar: AppBar(title: const Text('Your Cart')),
      body: cart.isEmpty
          ? Center(
              child: Column(mainAxisSize: MainAxisSize.min, children: [
                const Icon(Icons.shopping_bag_outlined, size: 56, color: CanteenColors.muted),
                const SizedBox(height: 12),
                const Text('Your cart is empty', style: TextStyle(fontSize: 16)),
                const SizedBox(height: 12),
                TextButton(onPressed: () => context.pop(), child: const Text('Browse the menu')),
              ]),
            )
          : ListView(padding: const EdgeInsets.all(16), children: [
              Card(
                child: Column(children: [
                  for (final e in cart)
                    ListTile(
                      title: Text(e.name, style: const TextStyle(fontWeight: FontWeight.w600)),
                      subtitle: Text(
                        _soldOut(menu, e) ? 'Sold out — remove to continue' : '${rupees(e.unitPricePaise)} each',
                        style: TextStyle(color: _soldOut(menu, e) ? CanteenColors.danger : CanteenColors.muted),
                      ),
                      trailing: QtyStepper(qty: e.qty, onAdd: () => notifier.increment(e.key), onRemove: () => notifier.decrement(e.key)),
                    ),
                ]),
              ),
              const SizedBox(height: 16),
              TextField(
                controller: _note,
                maxLength: 255,
                decoration: const InputDecoration(labelText: 'Note for the kitchen (optional)', hintText: 'e.g. less spicy'),
              ),
              const SizedBox(height: 8),
              Card(
                child: Padding(
                  padding: const EdgeInsets.all(16),
                  child: Column(children: [
                    Row(children: [
                      const Text('Total', style: TextStyle(fontSize: 18, fontWeight: FontWeight.w700)),
                      const Spacer(),
                      Text(rupees(total), style: const TextStyle(fontSize: 20, fontWeight: FontWeight.w800)),
                    ]),
                    const Divider(height: 24),
                    const Row(children: [
                      Icon(Icons.storefront_outlined, color: CanteenColors.blue),
                      SizedBox(width: 10),
                      Expanded(child: Text('Pay at the counter when you pick up — cash or UPI QR.')),
                    ]),
                  ]),
                ),
              ),
            ]),
      bottomNavigationBar: cart.isEmpty
          ? null
          : SafeArea(
              child: Padding(
                padding: const EdgeInsets.fromLTRB(16, 8, 16, 12),
                child: FilledButton(
                  onPressed: _busy || anySoldOut || !isOpen ? null : _place,
                  child: _busy
                      ? const SizedBox(width: 22, height: 22, child: CircularProgressIndicator(strokeWidth: 2.5, color: Colors.white))
                      : Text(!isOpen ? 'Ordering is closed' : 'Place order · ${rupees(total)}'),
                ),
              ),
            ),
    );
  }
}
