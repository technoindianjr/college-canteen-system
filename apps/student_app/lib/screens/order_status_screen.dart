import 'package:canteen_core/canteen_core.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../state/providers.dart';

/// "Order Placed! Your food will be ready soon. Estimated time…" — with the live status,
/// the pickup code and what to pay at the counter. Updates by itself over Socket.IO.
class OrderStatusScreen extends ConsumerWidget {
  const OrderStatusScreen({super.key, required this.orderId});
  final int orderId;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final fromList = ref.watch(ordersProvider).valueOrNull?.where((o) => o.id == orderId).firstOrNull;
    final AsyncValue<Order> order = fromList != null ? AsyncData(fromList) : ref.watch(orderByIdProvider(orderId));

    return Scaffold(
      appBar: AppBar(title: Text('Order #$orderId')),
      body: order.when(
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (e, _) => Center(child: Text(e.toString())),
        data: (o) => RefreshIndicator(
          onRefresh: () => ref.read(ordersProvider.notifier).refresh(),
          child: ListView(padding: const EdgeInsets.all(16), children: [
            _Header(order: o),
            const SizedBox(height: 16),
            if (o.status.isOpen) ...[_PickupCode(order: o), const SizedBox(height: 16), _Steps(status: o.status), const SizedBox(height: 16)],
            _Items(order: o),
            const SizedBox(height: 16),
            if (o.status == OrderStatus.placed) _CancelButton(order: o),
            if (o.status == OrderStatus.picked_up) _Feedback(orderId: o.id),
          ]),
        ),
      ),
    );
  }
}

class _Header extends StatelessWidget {
  const _Header({required this.order});
  final Order order;

  @override
  Widget build(BuildContext context) {
    final (IconData icon, Color color, String title, String sub) = switch (order.status) {
      OrderStatus.placed => (Icons.check_circle, CanteenColors.success, 'Order Placed!', 'Your food will be ready soon.'),
      OrderStatus.preparing => (Icons.soup_kitchen, CanteenColors.blue, 'Preparing your food', 'The kitchen is on it.'),
      OrderStatus.ready => (Icons.notifications_active, CanteenColors.success, 'Ready for pickup!', 'Show your code at the counter.'),
      OrderStatus.picked_up => (Icons.verified, CanteenColors.success, 'Enjoy your meal!', 'Collected ${order.closedAt != null ? 'at ${clockTime(order.closedAt!)}' : ''}'),
      OrderStatus.cancelled => (Icons.cancel, CanteenColors.muted, 'Order cancelled', 'You cancelled this order.'),
      OrderStatus.rejected => (Icons.error, CanteenColors.danger, 'Order could not be made', order.rejectReason ?? 'Sorry about that.'),
      OrderStatus.no_show => (Icons.timer_off, CanteenColors.danger, 'Not collected', 'This order was not picked up in time.'),
      OrderStatus.pending_payment => (Icons.payments, CanteenColors.muted, 'Awaiting payment', ''),
    };
    final eta = order.readyBy;
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(20),
        child: Column(children: [
          Icon(icon, size: 56, color: color),
          const SizedBox(height: 8),
          Text(title, style: const TextStyle(fontSize: 22, fontWeight: FontWeight.w800)),
          const SizedBox(height: 4),
          Text(sub, textAlign: TextAlign.center, style: const TextStyle(color: CanteenColors.muted)),
          if (eta != null && (order.status == OrderStatus.placed || order.status == OrderStatus.preparing)) ...[
            const SizedBox(height: 12),
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
              decoration: BoxDecoration(border: Border.all(color: CanteenColors.ink), borderRadius: BorderRadius.circular(12)),
              child: Text(_etaText(eta), style: const TextStyle(fontWeight: FontWeight.w600)),
            ),
          ],
        ]),
      ),
    );
  }

  static String _etaText(DateTime eta) {
    final mins = eta.difference(DateTime.now()).inMinutes;
    return mins <= 1 ? 'Estimated time: any minute now' : 'Estimated time: $mins mins (by ${clockTime(eta)})';
  }
}

class _PickupCode extends StatelessWidget {
  const _PickupCode({required this.order});
  final Order order;

  @override
  Widget build(BuildContext context) {
    final ready = order.status == OrderStatus.ready;
    return Container(
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        color: ready ? CanteenColors.success : CanteenColors.yellow,
        borderRadius: BorderRadius.circular(18),
      ),
      child: Column(children: [
        Text('Pickup code', style: TextStyle(color: ready ? Colors.white : CanteenColors.ink, fontWeight: FontWeight.w600)),
        const SizedBox(height: 4),
        Text(order.pickupCode,
            style: TextStyle(fontSize: 48, letterSpacing: 10, fontWeight: FontWeight.w900, color: ready ? Colors.white : CanteenColors.ink)),
        const SizedBox(height: 4),
        Text('Pay ${rupees(order.totalPaise)} at the counter · cash or UPI',
            style: TextStyle(color: ready ? Colors.white : CanteenColors.ink)),
      ]),
    );
  }
}

class _Steps extends StatelessWidget {
  const _Steps({required this.status});
  final OrderStatus status;

  static const _steps = [
    (OrderStatus.placed, 'Placed', Icons.receipt_long),
    (OrderStatus.preparing, 'Preparing', Icons.soup_kitchen),
    (OrderStatus.ready, 'Ready', Icons.shopping_bag),
    (OrderStatus.picked_up, 'Picked up', Icons.done_all),
  ];

  @override
  Widget build(BuildContext context) {
    final current = _steps.indexWhere((s) => s.$1 == status);
    return Row(children: [
      for (var i = 0; i < _steps.length; i++) ...[
        Expanded(
          child: Column(children: [
            CircleAvatar(
              radius: 18,
              backgroundColor: i <= current ? CanteenColors.blue : const Color(0xFFE2E0D8),
              child: Icon(_steps[i].$3, size: 18, color: i <= current ? Colors.white : CanteenColors.muted),
            ),
            const SizedBox(height: 6),
            Text(_steps[i].$2,
                style: TextStyle(fontSize: 12, fontWeight: i == current ? FontWeight.w700 : FontWeight.w400)),
          ]),
        ),
      ],
    ]);
  }
}

class _Items extends StatelessWidget {
  const _Items({required this.order});
  final Order order;

  @override
  Widget build(BuildContext context) {
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Text('Placed ${shortDateTime(order.createdAt)}', style: const TextStyle(color: CanteenColors.muted)),
          const SizedBox(height: 8),
          for (final l in order.items)
            Padding(
              padding: const EdgeInsets.symmetric(vertical: 4),
              child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
                Text('${l.qty}×  ', style: const TextStyle(fontWeight: FontWeight.w700)),
                Expanded(
                  child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                    Text(l.name),
                    if (l.note != null) Text(l.note!, style: const TextStyle(color: CanteenColors.muted, fontSize: 12)),
                  ]),
                ),
                Text(rupees(l.lineTotalPaise)),
              ]),
            ),
          if (order.note != null) ...[
            const SizedBox(height: 4),
            Text('Note: ${order.note}', style: const TextStyle(color: CanteenColors.muted)),
          ],
          const Divider(height: 24),
          Row(children: [
            const Text('Total', style: TextStyle(fontWeight: FontWeight.w700, fontSize: 16)),
            const Spacer(),
            Text(rupees(order.totalPaise), style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 16)),
          ]),
          if (order.paymentStatus == 'paid')
            Padding(
              padding: const EdgeInsets.only(top: 4),
              child: Text('Paid by ${order.paymentMethod == 'cash' ? 'cash' : 'UPI'}', style: const TextStyle(color: CanteenColors.success)),
            ),
        ]),
      ),
    );
  }
}

class _CancelButton extends ConsumerWidget {
  const _CancelButton({required this.order});
  final Order order;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return OutlinedButton(
      style: OutlinedButton.styleFrom(foregroundColor: CanteenColors.danger, side: const BorderSide(color: CanteenColors.danger)),
      onPressed: () async {
        final ok = await showDialog<bool>(
          context: context,
          builder: (c) => AlertDialog(
            title: const Text('Cancel this order?'),
            content: const Text('You can cancel until the kitchen accepts it.'),
            actions: [
              TextButton(onPressed: () => Navigator.pop(c, false), child: const Text('Keep it')),
              TextButton(onPressed: () => Navigator.pop(c, true), child: const Text('Cancel order')),
            ],
          ),
        );
        if (ok != true) return;
        try {
          await ref.read(ordersProvider.notifier).cancel(order.id);
        } on ApiException catch (e) {
          if (context.mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(e.message)));
        }
      },
      child: const Text('Cancel order'),
    );
  }
}

class _Feedback extends ConsumerStatefulWidget {
  const _Feedback({required this.orderId});
  final int orderId;

  @override
  ConsumerState<_Feedback> createState() => _FeedbackState();
}

class _FeedbackState extends ConsumerState<_Feedback> {
  int _rating = 0;
  bool _sent = false;

  Future<void> _send(int r) async {
    setState(() => _rating = r);
    try {
      await ref.read(apiProvider).sendFeedback(widget.orderId, r);
      if (mounted) setState(() => _sent = true);
    } on ApiException catch (e) {
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(e.message)));
    }
  }

  @override
  Widget build(BuildContext context) {
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(children: [
          Text(_sent ? 'Thanks for the feedback!' : 'How was it?', style: const TextStyle(fontWeight: FontWeight.w700)),
          const SizedBox(height: 8),
          Row(mainAxisAlignment: MainAxisAlignment.center, children: [
            for (var i = 1; i <= 5; i++)
              IconButton(
                onPressed: () => _send(i),
                icon: Icon(i <= _rating ? Icons.star : Icons.star_border, color: CanteenColors.yellow, size: 32),
              ),
          ]),
        ]),
      ),
    );
  }
}
