import 'package:canteen_core/canteen_core.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../state/providers.dart';
import 'item_image.dart';
import 'qty_stepper.dart';

/// A row in a menu list: photo, name, price, and the add / quantity control.
class MenuItemTile extends ConsumerWidget {
  const MenuItemTile({super.key, required this.item, this.categoryName, this.categoryIconKey, this.canOrder = true});

  final MenuItem item;
  final String? categoryName;
  final String? categoryIconKey;
  final bool canOrder;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final key = 'i${item.id}';
    final qty = ref.watch(cartProvider.select((c) => c.where((e) => e.key == key).fold(0, (n, e) => n + e.qty)));
    final cart = ref.read(cartProvider.notifier);
    final available = item.isAvailable && canOrder;
    return _Row(
      image: ItemImage(url: item.imageUrl, categoryName: categoryName, icon: categoryIcon(categoryIconKey), dimmed: !item.isAvailable),
      title: item.name,
      subtitle: item.description,
      price: item.pricePaise,
      isVeg: item.isVeg,
      trailing: QtyStepper(
        qty: qty,
        enabled: item.isAvailable,
        onAdd: available ? () => cart.addItem(item) : () => _closed(context),
        onRemove: () => cart.decrement(key),
      ),
    );
  }
}

class ComboTile extends ConsumerWidget {
  const ComboTile({super.key, required this.combo, this.canOrder = true});

  final Combo combo;
  final bool canOrder;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final key = 'c${combo.id}';
    final qty = ref.watch(cartProvider.select((c) => c.where((e) => e.key == key).fold(0, (n, e) => n + e.qty)));
    final cart = ref.read(cartProvider.notifier);
    return _Row(
      image: ItemImage(url: combo.imageUrl, categoryName: 'Combos', icon: Icons.fastfood, dimmed: !combo.isAvailable),
      title: combo.name,
      subtitle: combo.contents,
      price: combo.pricePaise,
      trailing: QtyStepper(
        qty: qty,
        enabled: combo.isAvailable,
        onAdd: canOrder ? () => cart.addCombo(combo) : () => _closed(context),
        onRemove: () => cart.decrement(key),
      ),
    );
  }
}

void _closed(BuildContext context) => ScaffoldMessenger.of(context)
    .showSnackBar(const SnackBar(content: Text('App ordering is closed right now')));

class _Row extends StatelessWidget {
  const _Row({required this.image, required this.title, this.subtitle, required this.price, this.isVeg, required this.trailing});

  final Widget image;
  final String title;
  final String? subtitle;
  final int price;
  final bool? isVeg;
  final Widget trailing;

  @override
  Widget build(BuildContext context) {
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(12),
        child: Row(children: [
          image,
          const SizedBox(width: 12),
          Expanded(
            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Row(children: [
                if (isVeg != null) ...[_VegMark(isVeg: isVeg!), const SizedBox(width: 6)],
                Flexible(child: Text(title, style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w600))),
              ]),
              if (subtitle != null && subtitle!.isNotEmpty)
                Padding(
                  padding: const EdgeInsets.only(top: 2),
                  child: Text(subtitle!, maxLines: 2, overflow: TextOverflow.ellipsis, style: const TextStyle(color: CanteenColors.muted, fontSize: 13)),
                ),
              const SizedBox(height: 4),
              Text(rupees(price), style: const TextStyle(fontSize: 15, fontWeight: FontWeight.w700)),
            ]),
          ),
          trailing,
        ]),
      ),
    );
  }
}

/// Indian veg / non-veg symbol: square with a dot.
class _VegMark extends StatelessWidget {
  const _VegMark({required this.isVeg});
  final bool isVeg;

  @override
  Widget build(BuildContext context) {
    final c = isVeg ? CanteenColors.success : CanteenColors.danger;
    return Container(
      width: 14,
      height: 14,
      decoration: BoxDecoration(border: Border.all(color: c, width: 1.5), borderRadius: BorderRadius.circular(2)),
      child: Center(child: Container(width: 6, height: 6, decoration: BoxDecoration(color: c, shape: BoxShape.circle))),
    );
  }
}
