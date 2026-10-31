import 'package:canteen_core/canteen_core.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../state/providers.dart';
import '../widgets/cart_bar.dart';
import '../widgets/item_tile.dart';

/// Item list for one category ("← Snacks" in the chart), or all combos.
class CategoryScreen extends ConsumerWidget {
  const CategoryScreen({super.key, required this.categoryId});

  /// Pseudo id used for the combos list.
  static const combosId = -1;
  final int categoryId;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final menu = ref.watch(menuProvider);
    return menu.when(
      loading: () => const Scaffold(body: Center(child: CircularProgressIndicator())),
      error: (e, _) => Scaffold(appBar: AppBar(), body: Center(child: Text(e.toString()))),
      data: (m) {
        if (categoryId == combosId) {
          return _scaffold(
            title: 'Combos',
            children: [for (final c in m.combos) ComboTile(combo: c, canOrder: m.ordering.isOpen)],
            empty: 'No combos today',
          );
        }
        final cat = m.categories.where((c) => c.id == categoryId).firstOrNull;
        if (cat == null) return _scaffold(title: 'Menu', children: const [], empty: 'Category not found');
        // Available items first
        final items = [...cat.items]..sort((a, b) => (b.isAvailable ? 1 : 0) - (a.isAvailable ? 1 : 0));
        return _scaffold(
          title: cat.name,
          children: [
            for (final i in items) MenuItemTile(item: i, categoryName: cat.name, categoryIconKey: cat.icon, canOrder: m.ordering.isOpen),
          ],
          empty: 'Nothing here yet',
        );
      },
    );
  }

  Widget _scaffold({required String title, required List<Widget> children, required String empty}) {
    return Scaffold(
      appBar: AppBar(title: Text(title)),
      bottomNavigationBar: const CartBar(),
      body: children.isEmpty
          ? Center(child: Text(empty, style: const TextStyle(color: CanteenColors.muted)))
          : ListView.separated(
              padding: const EdgeInsets.all(16),
              itemCount: children.length,
              separatorBuilder: (_, __) => const SizedBox(height: 10),
              itemBuilder: (_, i) => children[i],
            ),
    );
  }
}
