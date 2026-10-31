import 'package:socket_io_client/socket_io_client.dart' as io;

import 'config.dart';
import 'models.dart';

/// Live updates from the server (Socket.IO). Connect after login with the API token.
class RealtimeClient {
  io.Socket? _socket;

  void Function(Order order)? onOrderUpdated;
  void Function(Order order)? onOrderCreated; // staff only
  void Function()? onMenuChanged;
  void Function(Map<String, dynamic> settings)? onSettingsChanged;
  void Function(bool connected)? onConnectionChanged;

  bool get isConnected => _socket?.connected ?? false;

  void connect(String token) {
    disconnect();
    final s = io.io(
      AppConfig.apiUrl,
      io.OptionBuilder()
          .setTransports(['websocket'])
          .setPath('/socket.io')
          .setAuth({'token': token})
          .enableReconnection()
          .disableAutoConnect()
          .build(),
    );
    s.onConnect((_) => onConnectionChanged?.call(true));
    s.onDisconnect((_) => onConnectionChanged?.call(false));
    s.on('order:updated', (data) => onOrderUpdated?.call(Order.fromJson(_map(data))));
    s.on('order:new', (data) => onOrderCreated?.call(Order.fromJson(_map(data))));
    s.on('menu:changed', (_) => onMenuChanged?.call());
    s.on('settings:changed', (data) => onSettingsChanged?.call(_map(data)));
    s.connect();
    _socket = s;
  }

  void disconnect() {
    _socket?.dispose();
    _socket = null;
  }

  static Map<String, dynamic> _map(dynamic d) => (d as Map).cast<String, dynamic>();
}
