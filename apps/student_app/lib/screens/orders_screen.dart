import 'package:canteen_core/canteen_core.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../state/providers.dart';

class OrdersScreen extends ConsumerWidget {
  const OrdersScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final orders = ref.watch(ordersProvider);
    return Scaffold(
      appBar: AppBar(title: const Text('My orders')),
      body: RefreshIndicator(
        onRefresh: () => ref.read(ordersProvider.notifier).refresh(),
        child: orders.when(
          loading: () => const Center(child: CircularProgressIndicator()),
          error: (e, _) => ListView(children: [Padding(padding: const EdgeInsets.all(32), child: Text(e.toString()))]),
          data: (list) => list.isEmpty
              ? ListView(children: const [
                  SizedBox(height: 120),
                  Icon(Icons.receipt_long_outlined, size: 56, color: CanteenColors.muted),
                  SizedBox(height: 12),
                  Center(child: Text('No orders yet')),
                ])
              : ListView.separated(
                  padding: const EdgeInsets.all(16),
                  itemCount: list.length,
                  separatorBuilder: (_, __) => const SizedBox(height: 10),
                  itemBuilder: (_, i) => _OrderCard(order: list[i]),
                ),
        ),
      ),
    );
  }
}

class _OrderCard extends ConsumerWidget {
  const _OrderCard({required this.order});
  final Order order;

  Color get _color => switch (order.status) {
        OrderStatus.ready || OrderStatus.picked_up => CanteenColors.success,
        OrderStatus.placed || OrderStatus.preparing => CanteenColors.blue,
        OrderStatus.rejected || OrderStatus.no_show => CanteenColors.danger,
        _ => CanteenColors.muted,
      };

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final summary = order.items.map((l) => '${l.qty}× ${l.name}').join(', ');
    return Card(
      child: InkWell(
        borderRadius: BorderRadius.circular(16),
        onTap: () => context.push('/order/${order.id}'),
        child: Padding(
          padding: const EdgeInsets.all(14),
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Row(children: [
              Text('#${order.id}', style: const TextStyle(fontWeight: FontWeight.w800)),
              const SizedBox(width: 8),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                decoration: BoxDecoration(color: _color.withValues(alpha: 0.12), borderRadius: BorderRadius.circular(8)),
                child: Text(order.status.label, style: TextStyle(color: _color, fontWeight: FontWeight.w600, fontSize: 12)),
              ),
              const Spacer(),
              Text(rupees(order.totalPaise), style: const TextStyle(fontWeight: FontWeight.w700)),
            ]),
            const SizedBox(height: 6),
            Text(summary, maxLines: 2, overflow: TextOverflow.ellipsis),
            const SizedBox(height: 6),
            Row(children: [
              Text(shortDateTime(order.createdAt), style: const TextStyle(color: CanteenColors.muted, fontSize: 12)),
              const Spacer(),
              if (!order.status.isOpen)
                TextButton.icon(
                  onPressed: () => _reorder(context, ref),
                  icon: const Icon(Icons.replay, size: 18),
                  label: const Text('Reorder'),
                ),
            ]),
          ]),
        ),
      ),
    );
  }

  /// Puts the same items back in the cart (at today's prices, skipping anything sold out).
  void _reorder(BuildContext context, WidgetRef ref) {
    final menu = ref.read(menuProvider).valueOrNull;
    if (menu == null) return;
    final cart = ref.read(cartProvider.notifier);
    var skipped = 0;
    for (final l in order.items) {
      final item = l.menuItemId != null ? menu.itemById(l.menuItemId!) : null;
      final combo = l.comboId != null ? menu.comboById(l.comboId!) : null;
      if (item != null && item.isAvailable) {
        cart.addItem(item, qty: l.qty, note: l.note);
      } else if (combo != null && combo.isAvailable) {
        cart.addCombo(combo, qty: l.qty);
      } else {
        skipped++;
      }
    }
    if (skipped > 0) {
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('$skipped item(s) are not available today')));
    }
    context.push('/cart');
  }
}
