import 'package:flutter/material.dart';

/// Colours from the Campus Canteen design chart: sunny yellow title, deep blue buttons,
/// white rounded cards, and the coloured category circles.
class CanteenColors {
  static const yellow = Color(0xFFFFC72C);
  static const blue = Color(0xFF2343B0);
  static const blueLight = Color(0xFFE8EDFF);
  static const ink = Color(0xFF1D1D1F);
  static const muted = Color(0xFF6B6B76);
  static const surface = Color(0xFFFFFDF7);
  static const success = Color(0xFF2E9E5B);
  static const danger = Color(0xFFD64545);

  /// Category circle colours, in the chart's order.
  static const categoryColors = <String, Color>{
    'Snacks': Color(0xFFFFB020),
    'Meals': Color(0xFF3A9BDC),
    'Drinks': Color(0xFFB04FB8),
    'Combos': Color(0xFFFF7A45),
    'Healthy': Color(0xFF4CAF50),
    'Desserts': Color(0xFF3F3DB5),
  };

  static Color forCategory(String name) => categoryColors[name] ?? blue;
}

/// Icons for the six categories (from the `icon` field the server sends).
IconData categoryIcon(String? key) => switch (key) {
      'snack' => Icons.lunch_dining,
      'meal' => Icons.rice_bowl,
      'drink' => Icons.local_cafe,
      'combo' => Icons.fastfood,
      'healthy' => Icons.eco,
      'dessert' => Icons.icecream,
      _ => Icons.restaurant,
    };

ThemeData canteenTheme() {
  final scheme = ColorScheme.fromSeed(
    seedColor: CanteenColors.blue,
    primary: CanteenColors.blue,
    secondary: CanteenColors.yellow,
    surface: CanteenColors.surface,
  );
  final rounded = RoundedRectangleBorder(borderRadius: BorderRadius.circular(14));
  return ThemeData(
    useMaterial3: true,
    colorScheme: scheme,
    scaffoldBackgroundColor: CanteenColors.surface,
    appBarTheme: const AppBarTheme(
      backgroundColor: CanteenColors.surface,
      foregroundColor: CanteenColors.ink,
      elevation: 0,
      centerTitle: false,
      titleTextStyle: TextStyle(fontSize: 20, fontWeight: FontWeight.w700, color: CanteenColors.ink),
    ),
    cardTheme: CardThemeData(
      color: Colors.white,
      elevation: 0,
      margin: EdgeInsets.zero,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(16),
        side: const BorderSide(color: Color(0xFFE7E3D8)),
      ),
    ),
    filledButtonTheme: FilledButtonThemeData(
      style: FilledButton.styleFrom(
        backgroundColor: CanteenColors.blue,
        foregroundColor: Colors.white,
        minimumSize: const Size.fromHeight(52),
        shape: rounded,
        textStyle: const TextStyle(fontSize: 16, fontWeight: FontWeight.w600),
      ),
    ),
    outlinedButtonTheme: OutlinedButtonThemeData(
      style: OutlinedButton.styleFrom(
        foregroundColor: CanteenColors.blue,
        minimumSize: const Size.fromHeight(52),
        shape: rounded,
        side: const BorderSide(color: CanteenColors.blue),
        textStyle: const TextStyle(fontSize: 16, fontWeight: FontWeight.w600),
      ),
    ),
    inputDecorationTheme: InputDecorationTheme(
      filled: true,
      fillColor: Colors.white,
      border: OutlineInputBorder(borderRadius: BorderRadius.circular(14), borderSide: const BorderSide(color: Color(0xFFDAD6CC))),
      enabledBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(14), borderSide: const BorderSide(color: Color(0xFFDAD6CC))),
      contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
    ),
    navigationBarTheme: const NavigationBarThemeData(
      backgroundColor: Colors.white,
      indicatorColor: CanteenColors.blueLight,
    ),
    snackBarTheme: const SnackBarThemeData(behavior: SnackBarBehavior.floating),
  );
}
