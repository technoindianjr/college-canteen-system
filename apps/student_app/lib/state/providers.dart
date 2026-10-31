import 'package:canteen_core/canteen_core.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';

import '../services/phone_auth.dart';

// ------------------------------------------------------------------ singletons

final apiProvider = Provider<ApiClient>((ref) => ApiClient());
final realtimeProvider = Provider<RealtimeClient>((ref) {
  final rt = RealtimeClient();
  ref.onDispose(rt.disconnect);
  return rt;
});
final phoneAuthProvider = Provider<PhoneAuthService>((ref) => PhoneAuthService());
final storageProvider = Provider<FlutterSecureStorage>((ref) => const FlutterSecureStorage());

const _tokenKey = 'api_token';

// ------------------------------------------------------------------ auth

/// The logged-in user, or null. Loading while we check the saved session at start-up.
class AuthNotifier extends AsyncNotifier<AppUser?> {
  ApiClient get _api => ref.read(apiProvider);
  FlutterSecureStorage get _storage => ref.read(storageProvider);

  @override
  Future<AppUser?> build() async {
    _api.onUnauthorized = () {
      if (state.valueOrNull != null) logout();
    };
    final saved = await _storage.read(key: _tokenKey);
    if (saved == null) return null;
    _api.token = saved;
    try {
      final user = await _api.me();
      _onLoggedIn(saved);
      return user;
    } on ApiException catch (e) {
      if (e.isUnauthorized) {
        await _storage.delete(key: _tokenKey);
        _api.token = null;
        return null;
      }
      rethrow; // offline etc. -> splash shows "Retry"
    }
  }

  /// Called with a Firebase ID token (or dev token) after the OTP is verified.
  Future<void> loginWithIdToken(String idToken) async {
    final res = await _api.login(idToken);
    _api.token = res.token;
    await _storage.write(key: _tokenKey, value: res.token);
    _onLoggedIn(res.token);
    state = AsyncData(res.user);
  }

  Future<void> updateProfile({required String name, String? rollNo}) async {
    final user = await _api.updateProfile(name: name, rollNo: rollNo ?? '');
    state = AsyncData(user);
  }

  Future<void> logout() async {
    ref.read(realtimeProvider).disconnect();
    await ref.read(phoneAuthProvider).signOut();
    await _storage.delete(key: _tokenKey);
    _api.token = null;
    ref.read(cartProvider.notifier).clear();
    state = const AsyncData(null);
  }

  void _onLoggedIn(String token) => ref.read(realtimeProvider).connect(token);
}

final authProvider = AsyncNotifierProvider<AuthNotifier, AppUser?>(AuthNotifier.new);

// ------------------------------------------------------------------ menu

/// Whole menu in one call. Refetched when staff change availability (menu:changed event).
final menuProvider = FutureProvider<MenuData>((ref) => ref.watch(apiProvider).menu());

// ------------------------------------------------------------------ cart

class CartEntry {
  final int? menuItemId;
  final int? comboId;
  final String name;
  final int unitPricePaise;
  final int qty;
  final String? note;

  const CartEntry({this.menuItemId, this.comboId, required this.name, required this.unitPricePaise, required this.qty, this.note});

  String get key => menuItemId != null ? 'i$menuItemId' : 'c$comboId';
  int get totalPaise => unitPricePaise * qty;

  CartEntry copyWith({int? qty, String? note}) => CartEntry(
        menuItemId: menuItemId,
        comboId: comboId,
        name: name,
        unitPricePaise: unitPricePaise,
        qty: qty ?? this.qty,
        note: note ?? this.note,
      );

  CartLineInput toInput() => CartLineInput(menuItemId: menuItemId, comboId: comboId, qty: qty, note: note);
}

class CartNotifier extends Notifier<List<CartEntry>> {
  static const maxQty = 10;

  @override
  List<CartEntry> build() => const [];

  int qtyOf(String key) {
    for (final e in state) {
      if (e.key == key) return e.qty;
    }
    return 0;
  }

  void addItem(MenuItem item, {int qty = 1, String? note}) =>
      _add(CartEntry(menuItemId: item.id, name: item.name, unitPricePaise: item.pricePaise, qty: qty, note: note));

  void addCombo(Combo combo, {int qty = 1}) =>
      _add(CartEntry(comboId: combo.id, name: combo.name, unitPricePaise: combo.pricePaise, qty: qty));

  void _add(CartEntry entry) {
    final i = state.indexWhere((e) => e.key == entry.key);
    if (i == -1) {
      state = [...state, entry];
    } else {
      final merged = state[i].copyWith(qty: (state[i].qty + entry.qty).clamp(1, maxQty), note: entry.note);
      state = [...state]..[i] = merged;
    }
  }

  void increment(String key) => _change(key, 1);
  void decrement(String key) => _change(key, -1);

  void _change(String key, int delta) {
    final i = state.indexWhere((e) => e.key == key);
    if (i == -1) return;
    final next = state[i].qty + delta;
    if (next <= 0) {
      state = [...state]..removeAt(i);
    } else {
      state = [...state]..[i] = state[i].copyWith(qty: next.clamp(1, maxQty));
    }
  }

  void clear() => state = const [];
}

final cartProvider = NotifierProvider<CartNotifier, List<CartEntry>>(CartNotifier.new);

final cartTotalProvider = Provider<int>((ref) => ref.watch(cartProvider).fold(0, (sum, e) => sum + e.totalPaise));
final cartCountProvider = Provider<int>((ref) => ref.watch(cartProvider).fold(0, (sum, e) => sum + e.qty));

// ------------------------------------------------------------------ orders

/// The student's orders, newest first. Live-updated from Socket.IO events.
class OrdersNotifier extends AsyncNotifier<List<Order>> {
  @override
  Future<List<Order>> build() async {
    final user = ref.watch(authProvider).valueOrNull;
    if (user == null) return const [];
    return ref.read(apiProvider).myOrders();
  }

  void upsert(Order order) {
    final list = [...(state.valueOrNull ?? const <Order>[])];
    final i = list.indexWhere((o) => o.id == order.id);
    if (i == -1) {
      list.insert(0, order);
    } else {
      list[i] = order;
    }
    list.sort((a, b) => b.createdAt.compareTo(a.createdAt));
    state = AsyncData(list);
  }

  Future<Order> place(List<CartEntry> cart, {String? note}) async {
    final order = await ref.read(apiProvider).placeOrder(cart.map((e) => e.toInput()).toList(), note: note);
    upsert(order);
    return order;
  }

  Future<void> cancel(int id) async => upsert(await ref.read(apiProvider).cancelOrder(id));

  Future<void> refresh() async {
    state = AsyncData(await ref.read(apiProvider).myOrders());
  }
}

final ordersProvider = AsyncNotifierProvider<OrdersNotifier, List<Order>>(OrdersNotifier.new);

/// Fallback for opening an order that isn't in the list yet (e.g. from a notification).
final orderByIdProvider = FutureProvider.family<Order, int>((ref, id) => ref.read(apiProvider).order(id));
