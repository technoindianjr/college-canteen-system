import type { FastifyPluginAsync, FastifyRequest } from 'fastify';
import { randomUUID } from 'node:crypto';
import { createWriteStream } from 'node:fs';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import { pipeline } from 'node:stream/promises';
import { and, asc, desc, eq, gte, like, lt, or } from 'drizzle-orm';
import { z } from 'zod';
import { config } from '../config.js';
import { db, pool } from '../db/index.js';
import { categories, comboItems, combos, dailySpecials, menuItems, orders, users } from '../db/schema.js';
import { menuItemDto, userDto } from '../lib/dto.js';
import { badRequest, notFound } from '../lib/errors.js';
import { loadOrders } from '../lib/orders.js';
import { realtime } from '../lib/realtime.js';
import { DEFAULT_SETTINGS, getSettings, setSetting, type SettingKey } from '../lib/settings.js';
import { localDate, startOfLocalDay, tzOffset } from '../lib/time.js';
import { loadCombos } from './menu.js';

const idParam = z.object({ id: z.coerce.number().int().positive() });
const paise = z.number().int().min(0).max(10_000_00); // up to ₹10,000
const day = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

const categoryBody = z.object({
  name: z.string().trim().min(2).max(40),
  icon: z.string().trim().max(40).nullable().optional(),
  sortOrder: z.number().int().optional(),
  isActive: z.boolean().optional(),
});

const itemBody = z.object({
  categoryId: z.number().int().positive(),
  name: z.string().trim().min(2).max(80),
  description: z.string().trim().max(255).nullable().optional(),
  pricePaise: paise,
  isVeg: z.boolean().optional(),
  isAvailable: z.boolean().optional(),
  isActive: z.boolean().optional(),
  isPopular: z.boolean().optional(),
  prepMinutes: z.number().int().min(1).max(60).optional(),
});

const comboBody = z.object({
  name: z.string().trim().min(2).max(80),
  description: z.string().trim().max(255).nullable().optional(),
  pricePaise: paise,
  isAvailable: z.boolean().optional(),
  isActive: z.boolean().optional(),
  items: z.array(z.object({ menuItemId: z.number().int().positive(), qty: z.number().int().min(1).max(10) })).min(2),
});

const specialBody = z
  .object({
    date: day,
    menuItemId: z.number().int().positive().optional(),
    comboId: z.number().int().positive().optional(),
    title: z.string().trim().max(80).optional(),
  })
  .refine((b) => Boolean(b.menuItemId) !== Boolean(b.comboId), 'Pick exactly one of menuItemId or comboId');

const userPatch = z.object({
  role: z.enum(['student', 'staff', 'admin']).optional(),
  isBlocked: z.boolean().optional(),
  resetNoShows: z.boolean().optional(),
});

const settingsBody = z
  .object({
    orders_paused: z.enum(['true', 'false']),
    open_time: z.string().regex(/^\d{2}:\d{2}$/),
    close_time: z.string().regex(/^\d{2}:\d{2}$/),
    max_open_orders_per_student: z.string().regex(/^\d+$/),
    max_orders_per_10_min: z.string().regex(/^\d+$/),
    no_show_minutes: z.string().regex(/^\d+$/),
    no_show_block_after: z.string().regex(/^\d+$/),
  })
  .partial();

const IMAGE_TYPES: Record<string, string> = { 'image/jpeg': '.jpg', 'image/png': '.png', 'image/webp': '.webp' };

const routes: FastifyPluginAsync = async (app) => {
  app.addHook('preHandler', app.requireRole('admin'));

  // ------------------------------------------------------------ categories
  app.get('/admin/categories', async () => db.select().from(categories).orderBy(asc(categories.sortOrder)));

  app.post('/admin/categories', async (req, reply) => {
    const b = categoryBody.parse(req.body);
    const [res] = await db.insert(categories).values(b);
    realtime.menuChanged();
    return reply.code(201).send({ id: res.insertId, ...b });
  });

  app.patch('/admin/categories/:id', async (req) => {
    const { id } = idParam.parse(req.params);
    const b = categoryBody.partial().parse(req.body);
    await db.update(categories).set(b).where(eq(categories.id, id));
    realtime.menuChanged();
    const [c] = await db.select().from(categories).where(eq(categories.id, id));
    if (!c) throw notFound('Category');
    return c;
  });

  // ------------------------------------------------------------ menu items
  app.get('/admin/items', async () =>
    (await db.select().from(menuItems).orderBy(asc(menuItems.categoryId), asc(menuItems.name))).map(menuItemDto),
  );

  app.post('/admin/items', async (req, reply) => {
    const b = itemBody.parse(req.body);
    const [res] = await db.insert(menuItems).values(b);
    realtime.menuChanged();
    const [it] = await db.select().from(menuItems).where(eq(menuItems.id, res.insertId));
    return reply.code(201).send(menuItemDto(it));
  });

  app.patch('/admin/items/:id', async (req) => {
    const { id } = idParam.parse(req.params);
    const b = itemBody.partial().parse(req.body);
    if (Object.keys(b).length) await db.update(menuItems).set(b).where(eq(menuItems.id, id));
    const [it] = await db.select().from(menuItems).where(eq(menuItems.id, id));
    if (!it) throw notFound('Item');
    realtime.menuChanged();
    return menuItemDto(it);
  });

  async function saveImage(req: FastifyRequest) {
    const file = await req.file();
    if (!file) throw badRequest('no_file', 'Attach an image as multipart field "image"');
    const ext = IMAGE_TYPES[file.mimetype];
    if (!ext) throw badRequest('bad_type', 'Image must be JPEG, PNG or WebP');
    await mkdir(config.UPLOAD_DIR, { recursive: true });
    const name = `${randomUUID()}${ext}`;
    await pipeline(file.file, createWriteStream(path.join(config.UPLOAD_DIR, name)));
    if (file.file.truncated) throw badRequest('too_large', 'Image must be under 5 MB');
    return name;
  }

  app.post('/admin/items/:id/image', async (req) => {
    const { id } = idParam.parse(req.params);
    const name = await saveImage(req);
    const [res] = await db.update(menuItems).set({ imagePath: name }).where(eq(menuItems.id, id));
    if (res.affectedRows === 0) throw notFound('Item');
    realtime.menuChanged();
    return { imageUrl: `/uploads/${name}` };
  });

  // ------------------------------------------------------------ combos
  app.get('/admin/combos', async () => loadCombos(false));

  app.post('/admin/combos', async (req, reply) => {
    const { items, ...b } = comboBody.parse(req.body);
    const id = await db.transaction(async (tx) => {
      const [res] = await tx.insert(combos).values(b);
      await tx.insert(comboItems).values(items.map((i) => ({ ...i, comboId: res.insertId })));
      return res.insertId;
    });
    realtime.menuChanged();
    return reply.code(201).send((await loadCombos(false)).find((c) => c.id === id));
  });

  app.patch('/admin/combos/:id', async (req) => {
    const { id } = idParam.parse(req.params);
    const { items, ...b } = comboBody.partial().parse(req.body);
    await db.transaction(async (tx) => {
      if (Object.keys(b).length) await tx.update(combos).set(b).where(eq(combos.id, id));
      if (items) {
        await tx.delete(comboItems).where(eq(comboItems.comboId, id));
        await tx.insert(comboItems).values(items.map((i) => ({ ...i, comboId: id })));
      }
    });
    const c = (await loadCombos(false)).find((x) => x.id === id);
    if (!c) throw notFound('Combo');
    realtime.menuChanged();
    return c;
  });

  app.post('/admin/combos/:id/image', async (req) => {
    const { id } = idParam.parse(req.params);
    const name = await saveImage(req);
    const [res] = await db.update(combos).set({ imagePath: name }).where(eq(combos.id, id));
    if (res.affectedRows === 0) throw notFound('Combo');
    realtime.menuChanged();
    return { imageUrl: `/uploads/${name}` };
  });

  // ------------------------------------------------------------ daily specials
  app.get('/admin/specials', async (req) => {
    const { from } = z.object({ from: day.optional() }).parse(req.query);
    return db
      .select()
      .from(dailySpecials)
      .where(gte(dailySpecials.date, from ?? localDate()))
      .orderBy(asc(dailySpecials.date));
  });

  app.post('/admin/specials', async (req, reply) => {
    const b = specialBody.parse(req.body);
    const [res] = await db.insert(dailySpecials).values(b);
    realtime.menuChanged();
    return reply.code(201).send({ id: res.insertId, ...b });
  });

  app.delete('/admin/specials/:id', async (req) => {
    const { id } = idParam.parse(req.params);
    await db.delete(dailySpecials).where(eq(dailySpecials.id, id));
    realtime.menuChanged();
    return { ok: true };
  });

  // ------------------------------------------------------------ users
  app.get('/admin/users', async (req) => {
    const q = z
      .object({ q: z.string().trim().optional(), role: z.enum(['student', 'staff', 'admin']).optional(), blocked: z.enum(['true', 'false']).optional() })
      .parse(req.query);
    const conds = [];
    if (q.q) conds.push(or(like(users.phone, `%${q.q}%`), like(users.name, `%${q.q}%`), like(users.rollNo, `%${q.q}%`)));
    if (q.role) conds.push(eq(users.role, q.role));
    if (q.blocked) conds.push(eq(users.isBlocked, q.blocked === 'true'));
    const list = await db
      .select()
      .from(users)
      .where(conds.length ? and(...conds) : undefined)
      .orderBy(desc(users.createdAt))
      .limit(200);
    return list.map(userDto);
  });

  /** Make someone staff/admin before they log in, by phone number. */
  app.post('/admin/users', async (req, reply) => {
    const b = z
      .object({ phone: z.string().regex(/^\+[1-9]\d{7,14}$/), name: z.string().trim().max(80).optional(), role: z.enum(['student', 'staff', 'admin']) })
      .parse(req.body);
    await db
      .insert(users)
      .values(b)
      .onDuplicateKeyUpdate({ set: { role: b.role, ...(b.name ? { name: b.name } : {}) } });
    const [u] = await db.select().from(users).where(eq(users.phone, b.phone));
    return reply.code(201).send(userDto(u));
  });

  app.patch('/admin/users/:id', async (req) => {
    const { id } = idParam.parse(req.params);
    const b = userPatch.parse(req.body);
    if (id === req.user.sub && b.role && b.role !== 'admin') throw badRequest('self_demote', "You can't remove your own admin role");
    await db
      .update(users)
      .set({
        ...(b.role ? { role: b.role } : {}),
        ...(b.isBlocked !== undefined ? { isBlocked: b.isBlocked } : {}),
        ...(b.resetNoShows ? { noShowCount: 0 } : {}),
      })
      .where(eq(users.id, id));
    const [u] = await db.select().from(users).where(eq(users.id, id));
    if (!u) throw notFound('User');
    return userDto(u);
  });

  // ------------------------------------------------------------ settings
  app.get('/admin/settings', async () => getSettings());

  app.put('/admin/settings', async (req) => {
    const b = settingsBody.parse(req.body);
    for (const [k, v] of Object.entries(b)) {
      if (k in DEFAULT_SETTINGS && v !== undefined) await setSetting(k as SettingKey, v);
    }
    const s = await getSettings();
    realtime.settingsChanged({ ordersPaused: s.orders_paused === 'true', openTime: s.open_time, closeTime: s.close_time });
    return s;
  });

  // ------------------------------------------------------------ orders + reports
  app.get('/admin/orders', async (req) => {
    const { date } = z.object({ date: day.optional() }).parse(req.query);
    const d = date ?? localDate();
    const start = startOfLocalDay(d);
    const end = new Date(start.getTime() + 86_400_000);
    return loadOrders(and(gte(orders.createdAt, start), lt(orders.createdAt, end))!, { withCustomer: true, limit: 1000 });
  });

  /** Sales summary for a local date range (inclusive). Revenue counts collected (paid) orders only. */
  app.get('/admin/reports/summary', async (req) => {
    const q = z.object({ from: day.optional(), to: day.optional() }).parse(req.query);
    const to = q.to ?? localDate();
    const from = q.from ?? to;
    const start = startOfLocalDay(from);
    const end = new Date(startOfLocalDay(to).getTime() + 86_400_000);
    const off = tzOffset();
    const run = async <T>(text: string, params: unknown[]) => (await pool.query(text, params))[0] as T;

    const [totals] = await run<any[]>(
      `SELECT COUNT(*) AS orders,
              SUM(status = 'picked_up') AS collected,
              SUM(status = 'cancelled') AS cancelled,
              SUM(status = 'rejected') AS rejected,
              SUM(status = 'no_show') AS noShows,
              COALESCE(SUM(CASE WHEN payment_status = 'paid' THEN total_paise END), 0) AS revenuePaise,
              COALESCE(SUM(CASE WHEN payment_method = 'cash' AND payment_status = 'paid' THEN total_paise END), 0) AS cashPaise,
              COALESCE(SUM(CASE WHEN payment_method = 'upi_counter' AND payment_status = 'paid' THEN total_paise END), 0) AS upiPaise,
              ROUND(AVG(CASE WHEN ready_at IS NOT NULL THEN TIMESTAMPDIFF(SECOND, created_at, ready_at) END) / 60, 1) AS avgMinutesToReady,
              ROUND(AVG(CASE WHEN closed_at IS NOT NULL AND status = 'picked_up' THEN TIMESTAMPDIFF(SECOND, ready_at, closed_at) END) / 60, 1) AS avgMinutesReadyToPickup
         FROM orders WHERE created_at >= ? AND created_at < ?`,
      [start, end],
    );

    const byDay = await run<any[]>(
      `SELECT DATE_FORMAT(CONVERT_TZ(created_at, '+00:00', ?), '%Y-%m-%d') AS day,
              COUNT(*) AS orders,
              COALESCE(SUM(CASE WHEN payment_status = 'paid' THEN total_paise END), 0) AS revenuePaise
         FROM orders WHERE created_at >= ? AND created_at < ?
        GROUP BY day ORDER BY day`,
      [off, start, end],
    );

    const byHour = await run<any[]>(
      `SELECT HOUR(CONVERT_TZ(created_at, '+00:00', ?)) AS hour, COUNT(*) AS orders
         FROM orders WHERE created_at >= ? AND created_at < ?
        GROUP BY hour ORDER BY hour`,
      [off, start, end],
    );

    const topItems = await run<any[]>(
      `SELECT oi.name, SUM(oi.qty) AS qty, SUM(oi.qty * oi.unit_price_paise) AS revenuePaise
         FROM order_items oi JOIN orders o ON o.id = oi.order_id
        WHERE o.created_at >= ? AND o.created_at < ? AND o.status = 'picked_up'
        GROUP BY oi.name ORDER BY qty DESC LIMIT 10`,
      [start, end],
    );

    const [rating] = await run<any[]>(
      `SELECT ROUND(AVG(f.rating), 2) AS avgRating, COUNT(*) AS ratings
         FROM feedback f JOIN orders o ON o.id = f.order_id
        WHERE o.created_at >= ? AND o.created_at < ?`,
      [start, end],
    );

    const n = (v: unknown) => (v === null || v === undefined ? null : Number(v));
    return {
      from,
      to,
      totals: Object.fromEntries(Object.entries(totals).map(([k, v]) => [k, n(v)])),
      byDay: byDay.map((r) => ({ day: r.day, orders: n(r.orders), revenuePaise: n(r.revenuePaise) })),
      byHour: byHour.map((r) => ({ hour: n(r.hour), orders: n(r.orders) })),
      topItems: topItems.map((r) => ({ name: r.name, qty: n(r.qty), revenuePaise: n(r.revenuePaise) })),
      feedback: { avgRating: n(rating.avgRating), ratings: n(rating.ratings) },
    };
  });

};

export default routes;
