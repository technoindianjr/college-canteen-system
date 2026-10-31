import 'package:canteen_core/canteen_core.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../state/providers.dart';
import '../widgets/cart_bar.dart';
import '../widgets/item_tile.dart';

class SearchScreen extends ConsumerStatefulWidget {
  const SearchScreen({super.key});

  @override
  ConsumerState<SearchScreen> createState() => _SearchScreenState();
}

class _SearchScreenState extends ConsumerState<SearchScreen> {
  String _q = '';

  @override
  Widget build(BuildContext context) {
    final m = ref.watch(menuProvider).valueOrNull;
    final q = _q.trim().toLowerCase();
    final items = m == null || q.isEmpty
        ? const <MenuItem>[]
        : m.allItems.where((i) => i.name.toLowerCase().contains(q) || (i.description ?? '').toLowerCase().contains(q)).toList();
    final combos = m == null || q.isEmpty
        ? const <Combo>[]
        : m.combos.where((c) => c.name.toLowerCase().contains(q) || c.contents.toLowerCase().contains(q)).toList();

    return Scaffold(
      appBar: AppBar(
        title: TextField(
          autofocus: true,
          decoration: const InputDecoration(hintText: 'Search food...', border: InputBorder.none, filled: false),
          onChanged: (v) => setState(() => _q = v),
        ),
      ),
      bottomNavigationBar: const CartBar(),
      body: q.isEmpty
          ? const Center(child: Text('Try "burger", "coffee" or "combo"', style: TextStyle(color: CanteenColors.muted)))
          : (items.isEmpty && combos.isEmpty)
              ? const Center(child: Text('No matches', style: TextStyle(color: CanteenColors.muted)))
              : ListView(padding: const EdgeInsets.all(16), children: [
                  for (final i in items)
                    Padding(
                      padding: const EdgeInsets.only(bottom: 10),
                      child: MenuItemTile(
                        item: i,
                        categoryName: m!.categories.where((c) => c.id == i.categoryId).firstOrNull?.name,
                        categoryIconKey: m.categories.where((c) => c.id == i.categoryId).firstOrNull?.icon,
                        canOrder: m.ordering.isOpen,
                      ),
                    ),
                  for (final c in combos)
                    Padding(padding: const EdgeInsets.only(bottom: 10), child: ComboTile(combo: c, canOrder: m!.ordering.isOpen)),
                ]),
    );
  }
}
