import 'package:dio/dio.dart';

import 'config.dart';
import 'models.dart';

/// Error returned by the API: { error: "<code>", message: "<text for the user>" }.
class ApiException implements Exception {
  final int? statusCode;
  final String code;
  final String message;
  const ApiException(this.code, this.message, [this.statusCode]);

  bool get isUnauthorized => statusCode == 401;

  @override
  String toString() => message;
}

/// Thin wrapper over the Campus Canteen REST API (see server/README.md).
class ApiClient {
  ApiClient({String? baseUrl, this.onUnauthorized})
      : _dio = Dio(BaseOptions(
          baseUrl: baseUrl ?? AppConfig.apiBase,
          connectTimeout: const Duration(seconds: 10),
          receiveTimeout: const Duration(seconds: 20),
          contentType: Headers.jsonContentType,
        )) {
    _dio.interceptors.add(InterceptorsWrapper(onRequest: (options, handler) {
      final t = token;
      if (t != null) options.headers['Authorization'] = 'Bearer $t';
      handler.next(options);
    }));
  }

  final Dio _dio;

  /// Current API JWT; set after login.
  String? token;

  /// Called when the server says the session is no longer valid (401).
  void Function()? onUnauthorized;

  Future<T> _call<T>(Future<Response<dynamic>> Function() req, T Function(dynamic data) parse) async {
    try {
      final res = await req();
      return parse(res.data);
    } on DioException catch (e) {
      final status = e.response?.statusCode;
      final data = e.response?.data;
      if (status == 401) onUnauthorized?.call();
      if (data is Map && data['message'] is String) {
        throw ApiException(data['error'] as String? ?? 'error', data['message'] as String, status);
      }
      if (e.type == DioExceptionType.connectionTimeout ||
          e.type == DioExceptionType.connectionError ||
          e.type == DioExceptionType.receiveTimeout) {
        throw const ApiException('offline', "Can't reach the canteen server. Check your internet and try again.");
      }
      throw ApiException('error', 'Something went wrong (${status ?? e.type.name})', status);
    }
  }

  Map<String, dynamic> _map(dynamic d) => (d as Map).cast<String, dynamic>();
  List<Order> _orders(dynamic d) => (d as List).map((e) => Order.fromJson(_map(e))).toList();

  // ---------------------------------------------------------------- auth & profile

  /// Exchanges a Firebase ID token (or "dev:+91..." in dev mode) for an API token.
  Future<({String token, AppUser user})> login(String idToken) => _call(
        () => _dio.post('/auth/otp-login', data: {'idToken': idToken}),
        (d) => (token: d['token'] as String, user: AppUser.fromJson(_map(d['user']))),
      );

  Future<AppUser> me() => _call(() => _dio.get('/me'), (d) => AppUser.fromJson(_map(d)));

  Future<AppUser> updateProfile({String? name, String? rollNo, String? fcmToken}) => _call(
        () => _dio.patch('/me', data: {
          if (name != null) 'name': name,
          if (rollNo != null) 'rollNo': rollNo,
          if (fcmToken != null) 'fcmToken': fcmToken,
        }),
        (d) => AppUser.fromJson(_map(d)),
      );

  // ---------------------------------------------------------------- student

  Future<MenuData> menu() => _call(() => _dio.get('/menu'), (d) => MenuData.fromJson(_map(d)));

  Future<Order> placeOrder(List<CartLineInput> lines, {String? note}) => _call(
        () => _dio.post('/orders', data: {
          'items': lines.map((l) => l.toJson()).toList(),
          if (note != null && note.trim().isNotEmpty) 'note': note.trim(),
        }),
        (d) => Order.fromJson(_map(d)),
      );

  Future<List<Order>> myOrders() => _call(() => _dio.get('/orders/mine'), _orders);

  Future<Order> order(int id) => _call(() => _dio.get('/orders/$id'), (d) => Order.fromJson(_map(d)));

  Future<Order> cancelOrder(int id) => _call(() => _dio.post('/orders/$id/cancel'), (d) => Order.fromJson(_map(d)));

  Future<void> sendFeedback(int id, int rating, {String? comment}) => _call(
        () => _dio.post('/orders/$id/feedback', data: {'rating': rating, if (comment != null) 'comment': comment}),
        (_) {},
      );

  // ---------------------------------------------------------------- staff

  Future<List<Order>> staffOrders({bool todayOnly = false}) =>
      _call(() => _dio.get('/staff/orders', queryParameters: {'scope': todayOnly ? 'today' : 'open'}), _orders);

  Future<List<Order>> lookupByCode(String code) =>
      _call(() => _dio.get('/staff/lookup', queryParameters: {'code': code}), _orders);

  Future<Order> advanceOrder(int id, String action, {String? pickupCode, String? paymentMethod}) => _call(
        () => _dio.patch('/staff/orders/$id', data: {
          'action': action,
          if (pickupCode != null) 'pickupCode': pickupCode,
          if (paymentMethod != null) 'paymentMethod': paymentMethod,
        }),
        (d) => Order.fromJson(_map(d)),
      );

  Future<Order> rejectOrder(int id, String reason) =>
      _call(() => _dio.post('/staff/orders/$id/reject', data: {'reason': reason}), (d) => Order.fromJson(_map(d)));

  Future<void> setItemAvailable(int id, bool available) =>
      _call(() => _dio.patch('/staff/items/$id', data: {'isAvailable': available}), (_) {});

  Future<void> setComboAvailable(int id, bool available) =>
      _call(() => _dio.patch('/staff/combos/$id', data: {'isAvailable': available}), (_) {});

  Future<bool> setPaused(bool paused) =>
      _call(() => _dio.post('/staff/pause', data: {'paused': paused}), (d) => d['ordersPaused'] as bool);

  /// Raw access for the admin dashboard.
  Dio get dio => _dio;
}
