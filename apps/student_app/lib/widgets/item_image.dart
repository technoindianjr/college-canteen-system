import 'package:canteen_core/canteen_core.dart';
import 'package:flutter/material.dart';

/// Menu photo, or a coloured tile with the category icon when there's no photo yet.
class ItemImage extends StatelessWidget {
  const ItemImage({super.key, this.url, this.categoryName, this.icon, this.size = 64, this.dimmed = false});

  final String? url;
  final String? categoryName;
  final IconData? icon;
  final double size;
  final bool dimmed;

  @override
  Widget build(BuildContext context) {
    final color = CanteenColors.forCategory(categoryName ?? '');
    final fallback = Container(
      width: size,
      height: size,
      color: color.withValues(alpha: 0.15),
      child: Icon(icon ?? Icons.restaurant, color: color, size: size * 0.5),
    );
    final full = AppConfig.absolute(url);
    Widget img = full == null
        ? fallback
        : Image.network(full, width: size, height: size, fit: BoxFit.cover, errorBuilder: (_, __, ___) => fallback);
    if (dimmed) {
      img = ColorFiltered(colorFilter: const ColorFilter.mode(Colors.grey, BlendMode.saturation), child: img);
    }
    return ClipRRect(borderRadius: BorderRadius.circular(12), child: img);
  }
}
