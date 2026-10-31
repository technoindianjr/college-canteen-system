import type { FastifyPluginAsync } from 'fastify';
import { and, eq, gte, inArray } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '../db/index.js';
import { combos, menuItems, orders } from '../db/schema.js';
import { notFound } from '../lib/errors.js';
import { loadOrders, OPEN_STATUSES, staffAdvance, staffReject } from '../lib/orders.js';
import { realtime } from '../lib/realtime.js';
import { getSettings, setSetting } from '../lib/settings.js';
import { localDate, startOfLocalDay } from '../lib/time.js';

const idParam = z.object({ id: z.coerce.number().int().positive() });
const advanceBody = z.object({
  action: z.enum(['accept', 'ready', 'pickup']),
  pickupCode: z.string().regex(/^\d{4}$/).optional(),
  paymentMethod: z.enum(['cash', 'upi_counter']).optional(),
});
const rejectBody = z.object({ reason: z.string().trim().min(3).max(255) });
const availabilityBody = z.object({ isAvailable: z.boolean() });
const pauseBody = z.object({ paused: z.boolean() });
const listQuery = z.object({ scope: z.enum(['open', 'today']).default('open') });

const routes: FastifyPluginAsync = async (app) => {
  app.addHook('preHandler', app.requireRole('staff', 'admin'));

  /** Order board: open orders (default) or everything placed today. */
  app.get('/staff/orders', async (req) => {
    const { scope } = listQuery.parse(req.query);
    const where =
      scope === 'open'
        ? inArray(orders.status, OPEN_STATUSES)
        : gte(orders.createdAt, startOfLocalDay(localDate()));
    const list = await loadOrders(where, { withCustomer: true, limit: 300 });
    return list.reverse(); // oldest first, like a queue
  });

  /** Find a ready order by the 4-digit code the student shows at the counter. */
  app.get('/staff/lookup', async (req) => {
    const { code } = z.object({ code: z.string().regex(/^\d{4}$/) }).parse(req.query);
    const list = await loadOrders(and(eq(orders.pickupCode, code), inArray(orders.status, OPEN_STATUSES))!, {
      withCustomer: true,
    });
    if (!list.length) throw notFound('Open order with that code');
    return list;
  });

  /** accept | ready | pickup (pickup needs pickupCode + paymentMethod cash|upi_counter). */
  app.patch('/staff/orders/:id', async (req) => {
    const { id } = idParam.parse(req.params);
    const body = advanceBody.parse(req.body);
    return staffAdvance(id, body.action, body);
  });

  app.post('/staff/orders/:id/reject', async (req) => {
    const { id } = idParam.parse(req.params);
    const { reason } = rejectBody.parse(req.body);
    return staffReject(id, reason);
  });

  /** Sold-out toggle for an item. */
  app.patch('/staff/items/:id', async (req) => {
    const { id } = idParam.parse(req.params);
    const { isAvailable } = availabilityBody.parse(req.body);
    const [res] = await db.update(menuItems).set({ isAvailable }).where(eq(menuItems.id, id));
    if (res.affectedRows === 0) throw notFound('Item');
    realtime.menuChanged();
    return { id, isAvailable };
  });

  app.patch('/staff/combos/:id', async (req) => {
    const { id } = idParam.parse(req.params);
    const { isAvailable } = availabilityBody.parse(req.body);
    const [res] = await db.update(combos).set({ isAvailable }).where(eq(combos.id, id));
    if (res.affectedRows === 0) throw notFound('Combo');
    realtime.menuChanged();
    return { id, isAvailable };
  });

  /** Pause / resume new app orders (rush, closing time). */
  app.post('/staff/pause', async (req) => {
    const { paused } = pauseBody.parse(req.body);
    await setSetting('orders_paused', String(paused));
    realtime.settingsChanged({ ordersPaused: paused });
    const s = await getSettings();
    return { ordersPaused: s.orders_paused === 'true' };
  });
};

export default routes;
