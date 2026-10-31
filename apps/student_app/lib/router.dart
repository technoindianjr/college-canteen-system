import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import 'screens/cart_screen.dart';
import 'screens/category_screen.dart';
import 'screens/home_screen.dart';
import 'screens/login_screen.dart';
import 'screens/order_status_screen.dart';
import 'screens/orders_screen.dart';
import 'screens/otp_screen.dart';
import 'screens/profile_screen.dart';
import 'screens/profile_setup_screen.dart';
import 'screens/search_screen.dart';
import 'screens/shell.dart';
import 'screens/splash_screen.dart';
import 'state/providers.dart';

/// Re-runs the router's redirect whenever the login state changes.
class _AuthListenable extends ChangeNotifier {
  _AuthListenable(Ref ref) {
    ref.listen(authProvider, (_, __) => notifyListeners());
  }
}

const _publicPaths = {'/login', '/otp'};

final routerProvider = Provider<GoRouter>((ref) {
  final refresh = _AuthListenable(ref);
  ref.onDispose(refresh.dispose);

  return GoRouter(
    initialLocation: '/splash',
    refreshListenable: refresh,
    redirect: (context, state) {
      final auth = ref.read(authProvider);
      final path = state.matchedLocation;

      if (auth.isLoading || auth.hasError) return path == '/splash' ? null : '/splash';

      final user = auth.valueOrNull;
      if (user == null) return _publicPaths.contains(path) ? null : '/login';
      if (!user.profileComplete) return path == '/profile-setup' ? null : '/profile-setup';
      if (path == '/splash' || path == '/profile-setup' || _publicPaths.contains(path)) return '/home';
      return null;
    },
    routes: [
      GoRoute(path: '/splash', builder: (_, __) => const SplashScreen()),
      GoRoute(path: '/login', builder: (_, __) => const LoginScreen()),
      GoRoute(path: '/otp', builder: (_, state) => OtpScreen(phone: state.extra as String? ?? '')),
      GoRoute(path: '/profile-setup', builder: (_, __) => const ProfileSetupScreen()),
      StatefulShellRoute.indexedStack(
        builder: (_, __, shell) => AppShell(navigationShell: shell),
        branches: [
          StatefulShellBranch(routes: [GoRoute(path: '/home', builder: (_, __) => const HomeScreen())]),
          StatefulShellBranch(routes: [GoRoute(path: '/orders', builder: (_, __) => const OrdersScreen())]),
          StatefulShellBranch(routes: [GoRoute(path: '/profile', builder: (_, __) => const ProfileScreen())]),
        ],
      ),
      GoRoute(
        path: '/category/:id',
        builder: (_, state) => CategoryScreen(categoryId: int.parse(state.pathParameters['id']!)),
      ),
      GoRoute(path: '/combos', builder: (_, __) => const CategoryScreen(categoryId: CategoryScreen.combosId)),
      GoRoute(path: '/search', builder: (_, __) => const SearchScreen()),
      GoRoute(path: '/cart', builder: (_, __) => const CartScreen()),
      GoRoute(
        path: '/order/:id',
        builder: (_, state) => OrderStatusScreen(orderId: int.parse(state.pathParameters['id']!)),
      ),
    ],
  );
});
