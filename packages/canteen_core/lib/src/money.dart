/// Formats integer paise as rupees: 5000 -> "₹50", 4550 -> "₹45.50".
String rupees(int paise) {
  final whole = paise ~/ 100;
  final frac = paise % 100;
  return frac == 0 ? '₹$whole' : '₹$whole.${frac.toString().padLeft(2, '0')}';
}

/// 11:05 AM style time.
String clockTime(DateTime t) {
  final h = t.hour % 12 == 0 ? 12 : t.hour % 12;
  final m = t.minute.toString().padLeft(2, '0');
  return '$h:$m ${t.hour < 12 ? 'AM' : 'PM'}';
}

/// "Today, 11:05 AM" / "28 Oct, 1:30 PM".
String shortDateTime(DateTime t, {DateTime? now}) {
  final n = now ?? DateTime.now();
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  final sameDay = t.year == n.year && t.month == n.month && t.day == n.day;
  return '${sameDay ? 'Today' : '${t.day} ${months[t.month - 1]}'}, ${clockTime(t)}';
}
