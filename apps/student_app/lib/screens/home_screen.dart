import 'package:canteen_core/canteen_core.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../state/providers.dart';
import '../widgets/cart_bar.dart';
import '../widgets/item_image.dart';
import '../widgets/item_tile.dart';

/// Home from the chart: search, "Special Today!", six category circles, popular items.
class HomeScreen extends ConsumerWidget {
  const HomeScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final menu = ref.watch(menuProvider);
    final user = ref.watch(authProvider).valueOrNull;
    final activeOrder = ref.watch(ordersProvider).valueOrNull?.where((o) => o.status.isOpen).firstOrNull;

    return Scaffold(
      appBar: AppBar(
        title: const Text('Campus Canteen'),
        actions: [
          IconButton(icon: const Icon(Icons.shopping_bag_outlined), onPressed: () => context.push('/cart')),
        ],
      ),
      bottomNavigationBar: const CartBar(),
      body: RefreshIndicator(
        onRefresh: () async {
          ref.invalidate(menuProvider);
          await ref.read(menuProvider.future);
        },
        child: menu.when(
          loading: () => const Center(child: CircularProgressIndicator()),
          error: (e, _) => _ErrorView(message: e.toString(), onRetry: () => ref.invalidate(menuProvider)),
          data: (m) => ListView(padding: const EdgeInsets.fromLTRB(16, 4, 16, 24), children: [
            Text('Hi ${user?.name?.split(' ').first ?? 'there'}, hungry?',
                style: const TextStyle(fontSize: 15, color: CanteenColors.muted)),
            const SizedBox(height: 12),
            // Search box (opens the search screen)
            GestureDetector(
              onTap: () => context.push('/search'),
              child: const AbsorbPointer(
                child: TextField(decoration: InputDecoration(hintText: 'Search food...', prefixIcon: Icon(Icons.search))),
              ),
            ),
            const SizedBox(height: 16),
            if (!m.ordering.isOpen) _ClosedBanner(ordering: m.ordering),
            if (activeOrder != null) _ActiveOrderCard(order: activeOrder),
            _SpecialBanner(menu: m),
            const SizedBox(height: 20),
            const _SectionTitle('Categories'),
            const SizedBox(height: 12),
            _CategoryGrid(menu: m),
            if (m.popularItems.isNotEmpty) ...[
              const SizedBox(height: 24),
              const _SectionTitle('Popular items'),
              const SizedBox(height: 12),
              for (final item in m.popularItems)
                Padding(
                  padding: const EdgeInsets.only(bottom: 10),
                  child: MenuItemTile(
                    item: item,
                    categoryName: _categoryOf(m, item)?.name,
                    categoryIconKey: _categoryOf(m, item)?.icon,
                    canOrder: m.ordering.isOpen,
                  ),
                ),
            ],
            if (m.combos.isNotEmpty) ...[
              const SizedBox(height: 14),
              Row(children: [
                const Expanded(child: _SectionTitle('Student-friendly combos')),
                TextButton(onPressed: () => context.push('/combos'), child: const Text('See all')),
              ]),
              const SizedBox(height: 8),
              for (final c in m.combos.take(3))
                Padding(padding: const EdgeInsets.only(bottom: 10), child: ComboTile(combo: c, canOrder: m.ordering.isOpen)),
            ],
          ]),
        ),
      ),
    );
  }

  static Category? _categoryOf(MenuData m, MenuItem item) => m.categories.where((c) => c.id == item.categoryId).firstOrNull;
}

class _SectionTitle extends StatelessWidget {
  const _SectionTitle(this.text);
  final String text;
  @override
  Widget build(BuildContext context) =>
      Text(text, style: const TextStyle(fontSize: 18, fontWeight: FontWeight.w700));
}

class _CategoryGrid extends StatelessWidget {
  const _CategoryGrid({required this.menu});
  final MenuData menu;

  @override
  Widget build(BuildContext context) {
    return GridView.count(
      crossAxisCount: 3,
      shrinkWrap: true,
      physics: const NeverScrollableScrollPhysics(),
      mainAxisSpacing: 12,
      crossAxisSpacing: 12,
      childAspectRatio: 1.05,
      children: [
        for (final c in menu.categories)
          InkWell(
            borderRadius: BorderRadius.circular(16),
            // "Combos" shows the combo list; the rest show their items
            onTap: () => context.push(c.name == 'Combos' ? '/combos' : '/category/${c.id}'),
            child: Column(mainAxisAlignment: MainAxisAlignment.center, children: [
              CircleAvatar(
                radius: 30,
                backgroundColor: CanteenColors.forCategory(c.name),
                child: Icon(categoryIcon(c.icon), color: Colors.white, size: 28),
              ),
              const SizedBox(height: 8),
              Text(c.name, style: const TextStyle(fontWeight: FontWeight.w600)),
            ]),
          ),
      ],
    );
  }
}

class _SpecialBanner extends ConsumerWidget {
  const _SpecialBanner({required this.menu});
  final MenuData menu;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final special = menu.specials.firstOrNull;
    final item = special?.menuItemId != null ? menu.itemById(special!.menuItemId!) : null;
    final combo = special?.comboId != null ? menu.comboById(special!.comboId!) : null;
    final name = item?.name ?? combo?.name;
    final price = item?.pricePaise ?? combo?.pricePaise;

    return Container(
      padding: const EdgeInsets.all(18),
      decoration: BoxDecoration(
        color: CanteenColors.blueLight,
        borderRadius: BorderRadius.circular(18),
        border: Border.all(color: CanteenColors.blue.withValues(alpha: 0.25)),
      ),
      child: Row(children: [
        Expanded(
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Text(special?.title ?? 'Special Today!',
                style: const TextStyle(fontSize: 22, fontWeight: FontWeight.w800, color: CanteenColors.blue)),
            const SizedBox(height: 4),
            Text(
              name == null ? 'Pre-order now, skip the queue.' : '$name · ${rupees(price!)}',
              style: const TextStyle(fontSize: 15, color: CanteenColors.ink),
            ),
            if (name != null && menu.ordering.isOpen) ...[
              const SizedBox(height: 10),
              SizedBox(
                height: 38,
                child: FilledButton(
                  style: FilledButton.styleFrom(minimumSize: const Size(0, 38)),
                  onPressed: () {
                    final cart = ref.read(cartProvider.notifier);
                    if (item != null && item.isAvailable) cart.addItem(item);
                    if (combo != null && combo.isAvailable) cart.addCombo(combo);
                    ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('$name added to cart')));
                  },
                  child: const Text('Add to cart'),
                ),
              ),
            ],
          ]),
        ),
        if (item != null || combo != null)
          ItemImage(url: item?.imageUrl ?? combo?.imageUrl, categoryName: combo != null ? 'Combos' : null, size: 80),
      ]),
    );
  }
}

class _ActiveOrderCard extends StatelessWidget {
  const _ActiveOrderCard({required this.order});
  final Order order;

  @override
  Widget build(BuildContext context) {
    final ready = order.status == OrderStatus.ready;
    return Padding(
      padding: const EdgeInsets.only(bottom: 16),
      child: Material(
        color: ready ? CanteenColors.success : CanteenColors.yellow,
        borderRadius: BorderRadius.circular(16),
        child: InkWell(
          borderRadius: BorderRadius.circular(16),
          onTap: () => context.push('/order/${order.id}'),
          child: Padding(
            padding: const EdgeInsets.all(14),
            child: Row(children: [
              Icon(ready ? Icons.check_circle : Icons.timer_outlined, color: ready ? Colors.white : CanteenColors.ink),
              const SizedBox(width: 10),
              Expanded(
                child: Text(
                  ready ? 'Order #${order.id} is ready! Code ${order.pickupCode}' : 'Order #${order.id}: ${order.status.label}',
                  style: TextStyle(fontWeight: FontWeight.w700, color: ready ? Colors.white : CanteenColors.ink),
                ),
              ),
              Icon(Icons.chevron_right, color: ready ? Colors.white : CanteenColors.ink),
            ]),
          ),
        ),
      ),
    );
  }
}

class _ClosedBanner extends StatelessWidget {
  const _ClosedBanner({required this.ordering});
  final OrderingStatus ordering;

  @override
  Widget build(BuildContext context) {
    final text = ordering.paused
        ? 'The canteen has paused app orders for a few minutes.'
        : 'App ordering is open ${ordering.openTime}–${ordering.closeTime}.';
    return Container(
      margin: const EdgeInsets.only(bottom: 16),
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(color: const Color(0xFFFFEDED), borderRadius: BorderRadius.circular(12)),
      child: Row(children: [
        const Icon(Icons.info_outline, color: CanteenColors.danger),
        const SizedBox(width: 8),
        Expanded(child: Text(text)),
      ]),
    );
  }
}

class _ErrorView extends StatelessWidget {
  const _ErrorView({required this.message, required this.onRetry});
  final String message;
  final VoidCallback onRetry;

  @override
  Widget build(BuildContext context) {
    return ListView(padding: const EdgeInsets.all(32), children: [
      const SizedBox(height: 80),
      const Icon(Icons.wifi_off, size: 48, color: CanteenColors.muted),
      const SizedBox(height: 12),
      Text(message, textAlign: TextAlign.center),
      const SizedBox(height: 16),
      OutlinedButton(onPressed: onRetry, child: const Text('Try again')),
    ]);
  }
}
