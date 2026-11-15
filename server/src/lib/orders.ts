// Order rules for v1 (pay at the counter on pickup).
//   placed -> preparing -> ready -> picked_up (paid: cash | upi_counter)
//   placed -> cancelled (student)   placed|preparing -> rejected (staff)   ready -> no_show (job)
import { randomInt } from 'node:crypto';
import { and, count, desc, eq, gte, inArray, lt, sql } from 'drizzle-orm';
import { db } from '../db/index.js';
import {
  comboItems,
  combos,
  menuItems,
  orderItems,
  orders,
  users,
  type OrderStatus,
  type PaymentMethod,
} from '../db/schema.js';
import { badRequest, conflict, forbidden, notFound, tooMany } from './errors.js';
import { sendPush } from './firebase.js';
import { realtime } from './realtime.js';
import { getSettings, num } from './settings.js';
import { isWithinHours, minutesFromNow } from './time.js';

export const OPEN_STATUSES: OrderStatus[] = ['placed', 'preparing', 'ready'];

export interface CartLine {
  menuItemId?: number;
  comboId?: number;
  qty: number;
  note?: string;
}

type OrderRow = typeof orders.$inferSelect;
type ItemRow = typeof orderItems.$inferSelect;

export function toDto(o: OrderRow, items: ItemRow[], customer?: { name: string | null; rollNo: string | null; phone: string | null }) {
  return {
    id: o.id,
    userId: o.userId,
    status: o.status,
    totalPaise: o.totalPaise,
    pickupCode: o.pickupCode,
    paymentMethod: o.paymentMethod,
    paymentStatus: o.paymentStatus,
    note: o.note,
    rejectReason: o.rejectReason,
    readyBy: o.readyBy,
    acceptedAt: o.acceptedAt,
    readyAt: o.readyAt,
    closedAt: o.closedAt,
    createdAt: o.createdAt,
    items: items.map((i) => ({
      menuItemId: i.menuItemId,
      comboId: i.comboId,
      name: i.name,
      qty: i.qty,
      unitPricePaise: i.unitPricePaise,
      note: i.note,
    })),
    ...(customer ? { customer } : {}),
  };
}
export type OrderDto = ReturnType<typeof toDto>;

/** Loads orders with their items (and the customer for staff views), newest first. */
export async function loadOrders(where: ReturnType<typeof and> | ReturnType<typeof eq>, opts: { withCustomer?: boolean; limit?: number } = {}) {
  const rows = await db
    .select({ o: orders, phone: users.phone, name: users.name, rollNo: users.rollNo })
    .from(orders)
    .innerJoin(users, eq(users.id, orders.userId))
    .where(where)
    .orderBy(desc(orders.createdAt), desc(orders.id))
    .limit(opts.limit ?? 100);
  if (rows.length === 0) return [];
  const ids = rows.map((r) => r.o.id);
  const items = await db.select().from(orderItems).where(inArray(orderItems.orderId, ids));
  return rows.map((r) =>
    toDto(
      r.o,
      items.filter((i) => i.orderId === r.o.id),
      opts.withCustomer ? { name: r.name, rollNo: r.rollNo, phone: r.phone } : undefined,
    ),
  );
}

export async function loadOrder(id: number, withCustomer = false) {
  const [o] = await loadOrders(eq(orders.id, id), { withCustomer, limit: 1 });
  if (!o) throw notFound('Order');
  return o;
}

async function publish(id: number, isNew = false) {
  const dto = await loadOrder(id, true);
  if (isNew) realtime.orderCreated(dto);
  else realtime.orderUpdated(dto);
  return dto;
}

// ---------------------------------------------------------------- student actions

export async function createOrder(userId: number, lines: CartLine[], note?: string) {
  const s = await getSettings();
  if (s.orders_paused === 'true') throw conflict('orders_paused', 'The canteen has paused app orders for now');
  if (!isWithinHours(s.open_time, s.close_time))
    throw conflict('closed', `App ordering is open ${s.open_time}–${s.close_time}`);

  const [user] = await db.select().from(users).where(eq(users.id, userId));
  if (!user) throw notFound('User');
  if (user.isBlocked) throw forbidden('Your account is blocked from ordering. Please contact the canteen.');
  if (!user.name) throw badRequest('profile_incomplete', 'Add your name before ordering');

  const [{ open }] = await db
    .select({ open: count() })
    .from(orders)
    .where(and(eq(orders.userId, userId), inArray(orders.status, OPEN_STATUSES)));
  if (open >= num(s, 'max_open_orders_per_student'))
    throw tooMany('too_many_open_orders', `You can have at most ${s.max_open_orders_per_student} open orders`);

  const [{ recent }] = await db
    .select({ recent: count() })
    .from(orders)
    .where(gte(orders.createdAt, minutesFromNow(-10)));
  if (recent >= num(s, 'max_orders_per_10_min'))
    throw tooMany('busy', 'The canteen is very busy right now, please try again in a few minutes');

  // Merge duplicate lines and validate shape
  if (lines.length === 0) throw badRequest('empty_cart', 'Your cart is empty');
  const itemIds = [...new Set(lines.filter((l) => l.menuItemId).map((l) => l.menuItemId!))];
  const comboIds = [...new Set(lines.filter((l) => l.comboId).map((l) => l.comboId!))];

  const items = itemIds.length ? await db.select().from(menuItems).where(inArray(menuItems.id, itemIds)) : [];
  const combosFound = comboIds.length ? await db.select().from(combos).where(inArray(combos.id, comboIds)) : [];
  const comboParts = comboIds.length
    ? await db
        .select({ comboId: comboItems.comboId, prep: menuItems.prepMinutes, available: menuItems.isAvailable, active: menuItems.isActive })
        .from(comboItems)
        .innerJoin(menuItems, eq(menuItems.id, comboItems.menuItemId))
        .where(inArray(comboItems.comboId, comboIds))
    : [];

  let total = 0;
  let maxPrep = 0;
  const rows: Omit<ItemRow, 'id' | 'orderId'>[] = [];
  for (const l of lines) {
    if (l.menuItemId) {
      const it = items.find((i) => i.id === l.menuItemId);
      if (!it || !it.isActive) throw badRequest('item_not_found', 'An item in your cart is no longer on the menu');
      if (!it.isAvailable) throw conflict('sold_out', `${it.name} is sold out`);
      total += it.pricePaise * l.qty;
      maxPrep = Math.max(maxPrep, it.prepMinutes);
      rows.push({ menuItemId: it.id, comboId: null, name: it.name, qty: l.qty, unitPricePaise: it.pricePaise, note: l.note ?? null });
    } else if (l.comboId) {
      const c = combosFound.find((x) => x.id === l.comboId);
      if (!c || !c.isActive) throw badRequest('item_not_found', 'A combo in your cart is no longer on the menu');
      const parts = comboParts.filter((p) => p.comboId === c.id);
      if (!c.isAvailable || parts.some((p) => !p.available || !p.active)) throw conflict('sold_out', `${c.name} is sold out`);
      total += c.pricePaise * l.qty;
      maxPrep = Math.max(maxPrep, ...parts.map((p) => p.prep), 0);
      rows.push({ menuItemId: null, comboId: c.id, name: c.name, qty: l.qty, unitPricePaise: c.pricePaise, note: l.note ?? null });
    } else {
      throw badRequest('bad_line', 'Each cart line needs a menuItemId or comboId');
    }
  }

  // Estimated ready time: slowest item + ~2 min for every 3 orders already in the kitchen
  const [{ queue }] = await db
    .select({ queue: count() })
    .from(orders)
    .where(inArray(orders.status, ['placed', 'preparing']));
  const etaMinutes = Math.min(60, maxPrep + Math.ceil(queue / 3) * 2);

  const orderId = await db.transaction(async (tx) => {
    const [res] = await tx.insert(orders).values({
      userId,
      status: 'placed',
      totalPaise: total,
      pickupCode: String(randomInt(0, 10000)).padStart(4, '0'),
      note: note ?? null,
      readyBy: minutesFromNow(etaMinutes),
    });
    await tx.insert(orderItems).values(rows.map((r) => ({ ...r, orderId: res.insertId })));
    return res.insertId;
  });

  return publish(orderId, true);
}

export async function cancelOrder(userId: number, orderId: number) {
  const [o] = await db.select().from(orders).where(eq(orders.id, orderId));
  if (!o || o.userId !== userId) throw notFound('Order');
  const [res] = await db
    .update(orders)
    .set({ status: 'cancelled', closedAt: new Date() })
    .where(and(eq(orders.id, orderId), eq(orders.status, 'placed')));
  if (res.affectedRows === 0) throw conflict('cannot_cancel', 'This order is already being prepared and can no longer be cancelled');
  return publish(orderId);
}

// ---------------------------------------------------------------- staff actions

/** Moves an order one step: accept (placed→preparing), ready (preparing→ready), pickup (ready→picked_up). */
export async function staffAdvance(
  orderId: number,
  action: 'accept' | 'ready' | 'pickup',
  opts: { pickupCode?: string; paymentMethod?: PaymentMethod } = {},
) {
  const [o] = await db.select().from(orders).where(eq(orders.id, orderId));
  if (!o) throw notFound('Order');
  const now = new Date();

  let from: OrderStatus;
  let set: Partial<OrderRow>;
  if (action === 'accept') {
    from = 'placed';
    set = { status: 'preparing', acceptedAt: now };
  } else if (action === 'ready') {
    from = 'preparing';
    set = { status: 'ready', readyAt: now };
  } else {
    from = 'ready';
    if (!opts.pickupCode || opts.pickupCode !== o.pickupCode) throw badRequest('wrong_code', 'Pickup code does not match');
    if (opts.paymentMethod !== 'cash' && opts.paymentMethod !== 'upi_counter')
      throw badRequest('payment_method_required', 'Choose how the student paid: cash or upi_counter');
    set = { status: 'picked_up', closedAt: now, paymentMethod: opts.paymentMethod, paymentStatus: 'paid' };
  }

  const [res] = await db.update(orders).set(set).where(and(eq(orders.id, orderId), eq(orders.status, from)));
  if (res.affectedRows === 0) throw conflict('wrong_status', `Order is ${o.status}, cannot ${action}`);

  const dto = await publish(orderId);
  if (action === 'ready') {
    const [u] = await db.select({ fcmToken: users.fcmToken }).from(users).where(eq(users.id, o.userId));
    await sendPush(u?.fcmToken, 'Your order is ready!', `Order #${o.id}: show code ${o.pickupCode} at the counter.`, {
      orderId: String(o.id),
    });
  }
  return dto;
}

export async function staffReject(orderId: number, reason: string) {
  const [o] = await db.select().from(orders).where(eq(orders.id, orderId));
  if (!o) throw notFound('Order');
  const [res] = await db
    .update(orders)
    .set({ status: 'rejected', rejectReason: reason, closedAt: new Date() })
    .where(and(eq(orders.id, orderId), inArray(orders.status, ['placed', 'preparing'])));
  if (res.affectedRows === 0) throw conflict('wrong_status', `Order is ${o.status}, cannot reject`);
  const [u] = await db.select({ fcmToken: users.fcmToken }).from(users).where(eq(users.id, o.userId));
  await sendPush(u?.fcmToken, 'Order could not be made', `Order #${o.id}: ${reason}`, { orderId: String(o.id) });
  return publish(orderId);
}

// ---------------------------------------------------------------- scheduled job

/** Marks ready orders not collected in time as no-show; blocks repeat offenders. Returns ids changed. */
export async function sweepNoShows(now = new Date()) {
  const s = await getSettings();
  const cutoff = minutesFromNow(-num(s, 'no_show_minutes'), now);
  const stale = await db
    .select({ id: orders.id, userId: orders.userId })
    .from(orders)
    .where(and(eq(orders.status, 'ready'), lt(orders.readyAt, cutoff)));
  const changed: number[] = [];
  for (const o of stale) {
    const [res] = await db
      .update(orders)
      .set({ status: 'no_show', closedAt: now })
      .where(and(eq(orders.id, o.id), eq(orders.status, 'ready')));
    if (res.affectedRows === 0) continue;
    changed.push(o.id);
    await db.update(users).set({ noShowCount: sql`${users.noShowCount} + 1` }).where(eq(users.id, o.userId));
    await db
      .update(users)
      .set({ isBlocked: true })
      .where(and(eq(users.id, o.userId), gte(users.noShowCount, num(s, 'no_show_block_after'))));
    await publish(o.id);
  }
  return changed;
}
