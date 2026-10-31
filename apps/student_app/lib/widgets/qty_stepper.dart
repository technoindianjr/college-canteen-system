import 'package:canteen_core/canteen_core.dart';
import 'package:flutter/material.dart';

/// The round blue "+" from the chart, which turns into  −  2  +  once something is in the cart.
class QtyStepper extends StatelessWidget {
  const QtyStepper({super.key, required this.qty, required this.onAdd, required this.onRemove, this.enabled = true});

  final int qty;
  final VoidCallback onAdd;
  final VoidCallback onRemove;
  final bool enabled;

  @override
  Widget build(BuildContext context) {
    if (!enabled) {
      return const Text('Sold out', style: TextStyle(color: CanteenColors.danger, fontWeight: FontWeight.w600));
    }
    if (qty == 0) {
      return IconButton.filled(
        onPressed: onAdd,
        icon: const Icon(Icons.add),
        style: IconButton.styleFrom(backgroundColor: CanteenColors.blue, foregroundColor: Colors.white),
        tooltip: 'Add to cart',
      );
    }
    return Container(
      decoration: BoxDecoration(color: CanteenColors.blueLight, borderRadius: BorderRadius.circular(24)),
      child: Row(mainAxisSize: MainAxisSize.min, children: [
        IconButton(onPressed: onRemove, icon: const Icon(Icons.remove, size: 18), visualDensity: VisualDensity.compact),
        Text('$qty', style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 16)),
        IconButton(onPressed: onAdd, icon: const Icon(Icons.add, size: 18), visualDensity: VisualDensity.compact),
      ]),
    );
  }
}
