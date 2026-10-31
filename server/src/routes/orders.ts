import type { FastifyPluginAsync } from 'fastify';
import { and, eq } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '../db/index.js';
import { feedback, orders } from '../db/schema.js';
import { conflict, notFound } from '../lib/errors.js';
import { cancelOrder, createOrder, loadOrder, loadOrders } from '../lib/orders.js';

const line = z
  .object({
    menuItemId: z.number().int().positive().optional(),
    comboId: z.number().int().positive().optional(),
    qty: z.number().int().min(1).max(10),
    note: z.string().trim().max(120).optional(),
  })
  .refine((l) => Boolean(l.menuItemId) !== Boolean(l.comboId), 'Each line needs exactly one of menuItemId or comboId');

const createBody = z.object({
  items: z.array(line).min(1).max(20),
  note: z.string().trim().max(255).optional(),
});
const idParam = z.object({ id: z.coerce.number().int().positive() });
const feedbackBody = z.object({ rating: z.number().int().min(1).max(5), comment: z.string().trim().max(500).optional() });

const routes: FastifyPluginAsync = async (app) => {
  app.addHook('preHandler', app.authenticate);

  /** Place a pay-at-counter order. */
  app.post('/orders', async (req, reply) => {
    const body = createBody.parse(req.body);
    const order = await createOrder(req.user.sub, body.items, body.note);
    return reply.code(201).send(order);
  });

  app.get('/orders/mine', async (req) => loadOrders(eq(orders.userId, req.user.sub), { limit: 50 }));

  app.get('/orders/:id', async (req) => {
    const { id } = idParam.parse(req.params);
    const isStaff = req.user.role !== 'student';
    const o = await loadOrder(id, isStaff);
    if (!isStaff && o.userId !== req.user.sub) throw notFound('Order');
    return o;
  });

  app.post('/orders/:id/cancel', async (req) => {
    const { id } = idParam.parse(req.params);
    return cancelOrder(req.user.sub, id);
  });

  app.post('/orders/:id/feedback', async (req, reply) => {
    const { id } = idParam.parse(req.params);
    const body = feedbackBody.parse(req.body);
    const [o] = await db.select().from(orders).where(and(eq(orders.id, id), eq(orders.userId, req.user.sub)));
    if (!o) throw notFound('Order');
    if (o.status !== 'picked_up') throw conflict('not_collected', 'You can rate an order after collecting it');
    await db
      .insert(feedback)
      .values({ orderId: id, rating: body.rating, comment: body.comment ?? null })
      .onDuplicateKeyUpdate({ set: { rating: body.rating, comment: body.comment ?? null } });
    return reply.code(201).send({ ok: true });
  });
};

export default routes;
