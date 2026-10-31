import 'package:campus_canteen/state/providers.dart';
import 'package:canteen_core/canteen_core.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  test('rupees formats paise', () {
    expect(rupees(5000), '₹50');
    expect(rupees(4550), '₹45.50');
    expect(rupees(5), '₹0.05');
  });

  test('cart adds, merges, caps and totals', () {
    final c = ProviderContainer();
    addTearDown(c.dispose);
    const burger = MenuItem(id: 1, categoryId: 1, name: 'Veg Burger', pricePaise: 5000);
    const coffee = MenuItem(id: 2, categoryId: 3, name: 'Cold Coffee', pricePaise: 6000);
    final cart = c.read(cartProvider.notifier);

    cart.addItem(burger);
    cart.addItem(burger);
    cart.addItem(coffee);
    expect(c.read(cartCountProvider), 3);
    expect(c.read(cartTotalProvider), 16000); // 2 × ₹50 + ₹60

    for (var i = 0; i < 20; i++) {
      cart.increment('i1');
    }
    expect(cart.qtyOf('i1'), CartNotifier.maxQty);

    cart.decrement('i2');
    expect(c.read(cartProvider).length, 1);
  });

  test('order JSON from the API parses', () {
    final o = Order.fromJson({
      'id': 7,
      'userId': 3,
      'status': 'ready',
      'totalPaise': 11000,
      'pickupCode': '0427',
      'paymentMethod': null,
      'paymentStatus': 'unpaid',
      'note': null,
      'rejectReason': null,
      'readyBy': '2026-10-31T06:15:00.000Z',
      'acceptedAt': null,
      'readyAt': null,
      'closedAt': null,
      'createdAt': '2026-10-31T06:00:00.000Z',
      'items': [
        {'menuItemId': 1, 'comboId': null, 'name': 'Veg Burger', 'qty': 1, 'unitPricePaise': 5000, 'note': null},
        {'menuItemId': 2, 'comboId': null, 'name': 'Cold Coffee', 'qty': 1, 'unitPricePaise': 6000, 'note': null},
      ],
    });
    expect(o.status, OrderStatus.ready);
    expect(o.status.isOpen, true);
    expect(o.itemCount, 2);
    expect(o.pickupCode, '0427');
  });
}
