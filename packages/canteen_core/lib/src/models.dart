// ignore_for_file: constant_identifier_names
// Plain models matching the API's JSON (server/src/lib/dto.ts and orders.ts). Money is in paise.

DateTime? _date(dynamic v) => v == null ? null : DateTime.tryParse(v as String)?.toLocal();
int _int(dynamic v) => v is int ? v : int.parse(v.toString());

enum Role { student, staff, admin }

class AppUser {
  final int id;
  final String phone;
  final String? name;
  final String? rollNo;
  final Role role;
  final bool isBlocked;
  final int noShowCount;

  const AppUser({
    required this.id,
    required this.phone,
    this.name,
    this.rollNo,
    required this.role,
    this.isBlocked = false,
    this.noShowCount = 0,
  });

  bool get profileComplete => (name ?? '').trim().isNotEmpty;
  bool get isStaff => role == Role.staff || role == Role.admin;

  factory AppUser.fromJson(Map<String, dynamic> j) => AppUser(
        id: _int(j['id']),
        phone: j['phone'] as String,
        name: j['name'] as String?,
        rollNo: j['rollNo'] as String?,
        role: Role.values.byName(j['role'] as String),
        isBlocked: j['isBlocked'] as bool? ?? false,
        noShowCount: j['noShowCount'] as int? ?? 0,
      );
}

class MenuItem {
  final int id;
  final int categoryId;
  final String name;
  final String? description;
  final int pricePaise;
  final String? imageUrl;
  final bool isVeg;
  final bool isAvailable;
  final bool isPopular;
  final int prepMinutes;

  const MenuItem({
    required this.id,
    required this.categoryId,
    required this.name,
    this.description,
    required this.pricePaise,
    this.imageUrl,
    this.isVeg = true,
    this.isAvailable = true,
    this.isPopular = false,
    this.prepMinutes = 10,
  });

  factory MenuItem.fromJson(Map<String, dynamic> j) => MenuItem(
        id: _int(j['id']),
        categoryId: _int(j['categoryId']),
        name: j['name'] as String,
        description: j['description'] as String?,
        pricePaise: _int(j['pricePaise']),
        imageUrl: j['imageUrl'] as String?,
        isVeg: j['isVeg'] as bool? ?? true,
        isAvailable: j['isAvailable'] as bool? ?? true,
        isPopular: j['isPopular'] as bool? ?? false,
        prepMinutes: j['prepMinutes'] as int? ?? 10,
      );
}

class ComboPart {
  final int menuItemId;
  final String name;
  final int qty;
  const ComboPart({required this.menuItemId, required this.name, required this.qty});
  factory ComboPart.fromJson(Map<String, dynamic> j) =>
      ComboPart(menuItemId: _int(j['menuItemId']), name: j['name'] as String, qty: j['qty'] as int? ?? 1);
}

class Combo {
  final int id;
  final String name;
  final String? description;
  final int pricePaise;
  final String? imageUrl;
  final bool isAvailable;
  final List<ComboPart> items;

  const Combo({
    required this.id,
    required this.name,
    this.description,
    required this.pricePaise,
    this.imageUrl,
    this.isAvailable = true,
    this.items = const [],
  });

  /// "Veg Burger + Cold Coffee"
  String get contents => items.map((p) => p.qty > 1 ? '${p.qty}× ${p.name}' : p.name).join(' + ');

  factory Combo.fromJson(Map<String, dynamic> j) => Combo(
        id: _int(j['id']),
        name: j['name'] as String,
        description: j['description'] as String?,
        pricePaise: _int(j['pricePaise']),
        imageUrl: j['imageUrl'] as String?,
        isAvailable: j['isAvailable'] as bool? ?? true,
        items: ((j['items'] as List?) ?? []).map((e) => ComboPart.fromJson(e as Map<String, dynamic>)).toList(),
      );
}

class Category {
  final int id;
  final String name;
  final String? icon;
  final List<MenuItem> items;
  const Category({required this.id, required this.name, this.icon, this.items = const []});

  factory Category.fromJson(Map<String, dynamic> j) => Category(
        id: _int(j['id']),
        name: j['name'] as String,
        icon: j['icon'] as String?,
        items: ((j['items'] as List?) ?? []).map((e) => MenuItem.fromJson(e as Map<String, dynamic>)).toList(),
      );
}

class Special {
  final int id;
  final String? title;
  final int? menuItemId;
  final int? comboId;
  const Special({required this.id, this.title, this.menuItemId, this.comboId});
  factory Special.fromJson(Map<String, dynamic> j) => Special(
        id: _int(j['id']),
        title: j['title'] as String?,
        menuItemId: j['menuItemId'] as int?,
        comboId: j['comboId'] as int?,
      );
}

class OrderingStatus {
  final bool paused;
  final bool isOpen;
  final String openTime;
  final String closeTime;
  const OrderingStatus({required this.paused, required this.isOpen, required this.openTime, required this.closeTime});
  factory OrderingStatus.fromJson(Map<String, dynamic> j) => OrderingStatus(
        paused: j['paused'] as bool? ?? false,
        isOpen: j['isOpen'] as bool? ?? true,
        openTime: j['openTime'] as String? ?? '',
        closeTime: j['closeTime'] as String? ?? '',
      );
}

class MenuData {
  final String date;
  final OrderingStatus ordering;
  final List<Category> categories;
  final List<Combo> combos;
  final List<int> popularItemIds;
  final List<Special> specials;

  const MenuData({
    required this.date,
    required this.ordering,
    required this.categories,
    required this.combos,
    required this.popularItemIds,
    required this.specials,
  });

  List<MenuItem> get allItems => [for (final c in categories) ...c.items];
  List<MenuItem> get popularItems => allItems.where((i) => popularItemIds.contains(i.id)).toList();

  MenuItem? itemById(int id) {
    for (final i in allItems) {
      if (i.id == id) return i;
    }
    return null;
  }

  Combo? comboById(int id) {
    for (final c in combos) {
      if (c.id == id) return c;
    }
    return null;
  }

  factory MenuData.fromJson(Map<String, dynamic> j) => MenuData(
        date: j['date'] as String? ?? '',
        ordering: OrderingStatus.fromJson(j['ordering'] as Map<String, dynamic>),
        categories: ((j['categories'] as List?) ?? []).map((e) => Category.fromJson(e as Map<String, dynamic>)).toList(),
        combos: ((j['combos'] as List?) ?? []).map((e) => Combo.fromJson(e as Map<String, dynamic>)).toList(),
        popularItemIds: ((j['popularItemIds'] as List?) ?? []).map(_int).toList(),
        specials: ((j['specials'] as List?) ?? []).map((e) => Special.fromJson(e as Map<String, dynamic>)).toList(),
      );
}

enum OrderStatus { pending_payment, placed, preparing, ready, picked_up, cancelled, rejected, no_show }

extension OrderStatusX on OrderStatus {
  bool get isOpen => this == OrderStatus.placed || this == OrderStatus.preparing || this == OrderStatus.ready;

  String get label => switch (this) {
        OrderStatus.pending_payment => 'Awaiting payment',
        OrderStatus.placed => 'Order placed',
        OrderStatus.preparing => 'Preparing',
        OrderStatus.ready => 'Ready for pickup',
        OrderStatus.picked_up => 'Picked up',
        OrderStatus.cancelled => 'Cancelled',
        OrderStatus.rejected => 'Rejected',
        OrderStatus.no_show => 'Not collected',
      };
}

class OrderLine {
  final int? menuItemId;
  final int? comboId;
  final String name;
  final int qty;
  final int unitPricePaise;
  final String? note;
  const OrderLine({this.menuItemId, this.comboId, required this.name, required this.qty, required this.unitPricePaise, this.note});

  int get lineTotalPaise => qty * unitPricePaise;

  factory OrderLine.fromJson(Map<String, dynamic> j) => OrderLine(
        menuItemId: j['menuItemId'] as int?,
        comboId: j['comboId'] as int?,
        name: j['name'] as String,
        qty: _int(j['qty']),
        unitPricePaise: _int(j['unitPricePaise']),
        note: j['note'] as String?,
      );
}

class Customer {
  final String? name;
  final String? rollNo;
  final String phone;
  const Customer({this.name, this.rollNo, required this.phone});
  factory Customer.fromJson(Map<String, dynamic> j) =>
      Customer(name: j['name'] as String?, rollNo: j['rollNo'] as String?, phone: j['phone'] as String);
}

class Order {
  final int id;
  final int userId;
  final OrderStatus status;
  final int totalPaise;
  final String pickupCode;
  final String? paymentMethod;
  final String paymentStatus;
  final String? note;
  final String? rejectReason;
  final DateTime? readyBy;
  final DateTime? acceptedAt;
  final DateTime? readyAt;
  final DateTime? closedAt;
  final DateTime createdAt;
  final List<OrderLine> items;
  final Customer? customer;

  const Order({
    required this.id,
    required this.userId,
    required this.status,
    required this.totalPaise,
    required this.pickupCode,
    this.paymentMethod,
    this.paymentStatus = 'unpaid',
    this.note,
    this.rejectReason,
    this.readyBy,
    this.acceptedAt,
    this.readyAt,
    this.closedAt,
    required this.createdAt,
    this.items = const [],
    this.customer,
  });

  int get itemCount => items.fold(0, (n, l) => n + l.qty);

  factory Order.fromJson(Map<String, dynamic> j) => Order(
        id: _int(j['id']),
        userId: _int(j['userId']),
        status: OrderStatus.values.byName(j['status'] as String),
        totalPaise: _int(j['totalPaise']),
        pickupCode: j['pickupCode'] as String,
        paymentMethod: j['paymentMethod'] as String?,
        paymentStatus: j['paymentStatus'] as String? ?? 'unpaid',
        note: j['note'] as String?,
        rejectReason: j['rejectReason'] as String?,
        readyBy: _date(j['readyBy']),
        acceptedAt: _date(j['acceptedAt']),
        readyAt: _date(j['readyAt']),
        closedAt: _date(j['closedAt']),
        createdAt: _date(j['createdAt']) ?? DateTime.now(),
        items: ((j['items'] as List?) ?? []).map((e) => OrderLine.fromJson(e as Map<String, dynamic>)).toList(),
        customer: j['customer'] == null ? null : Customer.fromJson(j['customer'] as Map<String, dynamic>),
      );
}

/// One line in the cart, sent to POST /orders.
class CartLineInput {
  final int? menuItemId;
  final int? comboId;
  final int qty;
  final String? note;
  const CartLineInput({this.menuItemId, this.comboId, required this.qty, this.note});

  Map<String, dynamic> toJson() => {
        if (menuItemId != null) 'menuItemId': menuItemId,
        if (comboId != null) 'comboId': comboId,
        'qty': qty,
        if (note != null && note!.trim().isNotEmpty) 'note': note!.trim(),
      };
}
