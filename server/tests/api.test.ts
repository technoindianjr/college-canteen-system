import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { buildApp } from '../src/app.js';
import { pool } from '../src/db/index.js';
import { sweepNoShows } from '../src/lib/orders.js';

let app: FastifyInstance;
const ADMIN = '+910000000001';
const STAFF = '+910000000002';
const ALICE = '+910000000011';
const BOB = '+910000000012';
const CAROL = '+910000000013';

const tokens: Record<string, string> = {};
let menu: any;

async function call(method: string, url: string, who?: string, body?: unknown) {
  const res = await app.inject({
    method: method as any,
    url: `/api/v1${url}`,
    headers: who ? { authorization: `Bearer ${tokens[who]}` } : {},
    ...(body !== undefined ? { payload: body as any } : {}),
  });
  return { status: res.statusCode, body: res.body ? res.json() : null };
}

async function login(phone: string, name?: string) {
  const r = await call('POST', '/auth/otp-login', undefined, { idToken: `dev:${phone}` });
  expect(r.status).toBe(200);
  tokens[phone] = r.body.token;
  if (name) await call('PATCH', '/me', phone, { name, rollNo: 'R-' + phone.slice(-2) });
  return r.body.user;
}

const item = (name: string) => menu.categories.flatMap((c: any) => c.items).find((i: any) => i.name === name);
const combo = (name: string) => menu.combos.find((c: any) => c.name === name);

beforeAll(async () => {
  app = await buildApp();
  await app.ready();
  const admin = await login(ADMIN, 'Canteen Admin');
  expect(admin.role).toBe('admin');
  // open all day so tests don't depend on the clock; generous rate cap
  await call('PUT', '/admin/settings', ADMIN, { open_time: '00:00', close_time: '00:00', max_orders_per_10_min: '1000' });
  await call('POST', '/admin/users', ADMIN, { phone: STAFF, name: 'Counter Staff', role: 'staff' });
  await login(STAFF);
  await login(ALICE, 'Alice');
  await login(BOB, 'Bob');
  menu = (await call('GET', '/menu')).body;
});

afterAll(async () => {
  await app.close();
  await pool.end();
});

describe('basics', () => {
  it('health check reaches MySQL', async () => {
    const r = await call('GET', '/health');
    expect(r.status).toBe(200);
    expect(r.body.ok).toBe(true);
  });

  it('menu has the six chart categories, items and combos', async () => {
    expect(menu.categories.map((c: any) => c.name)).toEqual(['Snacks', 'Meals', 'Drinks', 'Combos', 'Healthy', 'Desserts']);
    expect(item('Veg Burger').pricePaise).toBe(5000);
    expect(combo('Burger + Cold Coffee').items).toHaveLength(2);
    expect(menu.ordering.isOpen).toBe(true);
  });

  it('rejects bad dev tokens and missing auth', async () => {
    expect((await call('POST', '/auth/otp-login', undefined, { idToken: 'dev:12345' })).status).toBe(401);
    expect((await call('GET', '/orders/mine')).status).toBe(401);
  });

  it('staff role comes from the admin pre-registration', async () => {
    const me = await call('GET', '/me', STAFF);
    expect(me.body.role).toBe('staff');
  });
});

describe('ordering rules', () => {
  it('requires a name before the first order', async () => {
    await login(CAROL);
    const r = await call('POST', '/orders', CAROL, { items: [{ menuItemId: item('Samosa').id, qty: 1 }] });
    expect(r.status).toBe(400);
    expect(r.body.error).toBe('profile_incomplete');
  });

  it('computes the total on the server from MySQL prices', async () => {
    const r = await call('POST', '/orders', ALICE, {
      items: [
        { menuItemId: item('Veg Burger').id, qty: 2, note: 'less spicy' },
        { comboId: combo('Burger + Cold Coffee').id, qty: 1 },
      ],
    });
    expect(r.status).toBe(201);
    expect(r.body.status).toBe('placed');
    expect(r.body.totalPaise).toBe(2 * 5000 + 9900);
    expect(r.body.pickupCode).toMatch(/^\d{4}$/);
    expect(r.body.paymentStatus).toBe('unpaid');
    expect(new Date(r.body.readyBy).getTime()).toBeGreaterThan(Date.now());
  });

  it('limits a student to 2 open orders', async () => {
    const one = await call('POST', '/orders', ALICE, { items: [{ menuItemId: item('Samosa').id, qty: 1 }] });
    expect(one.status).toBe(201);
    const three = await call('POST', '/orders', ALICE, { items: [{ menuItemId: item('Samosa').id, qty: 1 }] });
    expect(three.status).toBe(429);
    expect(three.body.error).toBe('too_many_open_orders');
    // cancel it to free a slot
    expect((await call('POST', `/orders/${one.body.id}/cancel`, ALICE)).body.status).toBe('cancelled');
  });

  it('validates cart lines', async () => {
    expect((await call('POST', '/orders', BOB, { items: [] })).status).toBe(400);
    expect((await call('POST', '/orders', BOB, { items: [{ qty: 1 }] })).status).toBe(400);
    expect((await call('POST', '/orders', BOB, { items: [{ menuItemId: 99999, qty: 1 }] })).body.error).toBe('item_not_found');
    expect((await call('POST', '/orders', BOB, { items: [{ menuItemId: item('Samosa').id, qty: 11 }] })).status).toBe(400);
  });

  it('students cannot see each other\'s orders or use staff endpoints', async () => {
    const mine = await call('GET', '/orders/mine', ALICE);
    const id = mine.body[0].id;
    expect((await call('GET', `/orders/${id}`, BOB)).status).toBe(404);
    expect((await call('GET', '/staff/orders', BOB)).status).toBe(403);
    expect((await call('GET', '/admin/users', STAFF)).status).toBe(403);
  });
});

describe('staff flow and pay at counter', () => {
  it('accept → ready → pickup with code and payment method', async () => {
    const placed = await call('POST', '/orders', BOB, { items: [{ menuItemId: item('Paneer Roll').id, qty: 1 }] });
    const id = placed.body.id;

    const board = await call('GET', '/staff/orders', STAFF);
    expect(board.body.some((o: any) => o.id === id && o.customer.name === 'Bob')).toBe(true);

    expect((await call('PATCH', `/staff/orders/${id}`, STAFF, { action: 'ready' })).status).toBe(409); // must accept first
    expect((await call('PATCH', `/staff/orders/${id}`, STAFF, { action: 'accept' })).body.status).toBe('preparing');
    expect((await call('POST', `/orders/${id}/cancel`, BOB)).body.error).toBe('cannot_cancel');
    expect((await call('PATCH', `/staff/orders/${id}`, STAFF, { action: 'ready' })).body.status).toBe('ready');

    const lookup = await call('GET', `/staff/lookup?code=${placed.body.pickupCode}`, STAFF);
    expect(lookup.body.map((o: any) => o.id)).toContain(id);

    const wrongCode = placed.body.pickupCode === '0000' ? '1111' : '0000';
    expect((await call('PATCH', `/staff/orders/${id}`, STAFF, { action: 'pickup', pickupCode: wrongCode, paymentMethod: 'cash' })).body.error).toBe('wrong_code');
    expect((await call('PATCH', `/staff/orders/${id}`, STAFF, { action: 'pickup', pickupCode: placed.body.pickupCode })).body.error).toBe('payment_method_required');

    const done = await call('PATCH', `/staff/orders/${id}`, STAFF, { action: 'pickup', pickupCode: placed.body.pickupCode, paymentMethod: 'upi_counter' });
    expect(done.body.status).toBe('picked_up');
    expect(done.body.paymentStatus).toBe('paid');
    expect(done.body.paymentMethod).toBe('upi_counter');

    expect((await call('POST', `/orders/${id}/feedback`, BOB, { rating: 5, comment: 'Fast!' })).status).toBe(201);
  });

  it('reject sends the order to rejected with a reason', async () => {
    const placed = await call('POST', '/orders', BOB, { items: [{ menuItemId: item('Veg Thali').id, qty: 1 }] });
    const r = await call('POST', `/staff/orders/${placed.body.id}/reject`, STAFF, { reason: 'Thali finished for today' });
    expect(r.body.status).toBe('rejected');
    expect(r.body.rejectReason).toBe('Thali finished for today');
  });

  it('sold-out item blocks ordering it and any combo containing it', async () => {
    const coffee = item('Cold Coffee');
    await call('PATCH', `/staff/items/${coffee.id}`, STAFF, { isAvailable: false });
    expect((await call('POST', '/orders', BOB, { items: [{ menuItemId: coffee.id, qty: 1 }] })).body.error).toBe('sold_out');
    expect((await call('POST', '/orders', BOB, { items: [{ comboId: combo('Burger + Cold Coffee').id, qty: 1 }] })).body.error).toBe('sold_out');
    const m = (await call('GET', '/menu')).body;
    expect(m.combos.find((c: any) => c.name === 'Burger + Cold Coffee').isAvailable).toBe(false);
    await call('PATCH', `/staff/items/${coffee.id}`, STAFF, { isAvailable: true });
  });

  it('pause stops new orders', async () => {
    await call('POST', '/staff/pause', STAFF, { paused: true });
    expect((await call('POST', '/orders', BOB, { items: [{ menuItemId: item('Samosa').id, qty: 1 }] })).body.error).toBe('orders_paused');
    await call('POST', '/staff/pause', STAFF, { paused: false });
  });
});

describe('no-shows', () => {
  it('marks uncollected ready orders as no-show and blocks after 3', async () => {
    const dave = '+910000000014';
    const user = await login(dave, 'Dave');
    for (let i = 0; i < 3; i++) {
      const o = await call('POST', '/orders', dave, { items: [{ menuItemId: item('Samosa').id, qty: 1 }] });
      expect(o.status).toBe(201);
      await call('PATCH', `/staff/orders/${o.body.id}`, STAFF, { action: 'accept' });
      await call('PATCH', `/staff/orders/${o.body.id}`, STAFF, { action: 'ready' });
      await pool.query('UPDATE orders SET ready_at = ready_at - INTERVAL 31 MINUTE WHERE id = ?', [o.body.id]);
      const changed = await sweepNoShows();
      expect(changed).toContain(o.body.id);
      expect((await call('GET', `/orders/${o.body.id}`, dave)).body.status).toBe('no_show');
    }
    const me = await call('GET', '/me', dave);
    expect(me.body.noShowCount).toBe(3);
    expect(me.body.isBlocked).toBe(true);
    expect((await call('POST', '/orders', dave, { items: [{ menuItemId: item('Samosa').id, qty: 1 }] })).status).toBe(403);

    // admin can unblock
    await call('PATCH', `/admin/users/${user.id}`, ADMIN, { isBlocked: false, resetNoShows: true });
    expect((await call('POST', '/orders', dave, { items: [{ menuItemId: item('Samosa').id, qty: 1 }] })).status).toBe(201);
  });
});

describe('admin', () => {
  it('price changes apply to new orders only', async () => {
    const samosa = item('Samosa');
    const before = await call('POST', '/orders', CAROL, { items: [{ menuItemId: samosa.id, qty: 1 }] });
    expect(before.status).toBe(400); // Carol still has no name
    await call('PATCH', '/me', CAROL, { name: 'Carol' });
    const o1 = await call('POST', '/orders', CAROL, { items: [{ menuItemId: samosa.id, qty: 1 }] });
    await call('PATCH', `/admin/items/${samosa.id}`, ADMIN, { pricePaise: 3500 });
    const o2 = await call('POST', '/orders', CAROL, { items: [{ menuItemId: samosa.id, qty: 1 }] });
    expect(o2.body.totalPaise).toBe(3500);
    expect((await call('GET', `/orders/${o1.body.id}`, CAROL)).body.totalPaise).toBe(3000);
  });

  it('creates a combo and a daily special', async () => {
    const c = await call('POST', '/admin/combos', ADMIN, {
      name: 'Fries + Soda',
      pricePaise: 8900,
      items: [{ menuItemId: item('French Fries').id, qty: 1 }, { menuItemId: item('Fresh Lime Soda').id, qty: 1 }],
    });
    expect(c.status).toBe(201);
    const today = (await call('GET', '/menu')).body.date;
    const s = await call('POST', '/admin/specials', ADMIN, { date: today, comboId: c.body.id, title: 'Special Today!' });
    expect(s.status).toBe(201);
    const m = (await call('GET', '/menu')).body;
    expect(m.specials[0].comboId).toBe(c.body.id);
  });

  it('demoting staff takes effect immediately', async () => {
    const tmp = '+910000000020';
    const u = (await call('POST', '/admin/users', ADMIN, { phone: tmp, role: 'staff' })).body;
    await login(tmp);
    expect((await call('GET', '/staff/orders', tmp)).status).toBe(200);
    await call('PATCH', `/admin/users/${u.id}`, ADMIN, { role: 'student' });
    expect((await call('GET', '/staff/orders', tmp)).status).toBe(403);
  });

  it('summary report counts collected revenue by payment method', async () => {
    const r = await call('GET', '/admin/reports/summary', ADMIN);
    expect(r.status).toBe(200);
    expect(r.body.totals.upiPaise).toBe(8000); // Bob's paneer roll
    expect(r.body.totals.revenuePaise).toBe(8000);
    expect(r.body.totals.noShows).toBe(3);
    expect(r.body.totals.rejected).toBe(1);
    expect(r.body.topItems[0].name).toBe('Paneer Roll');
    expect(r.body.feedback.avgRating).toBe(5);
  });
});

describe('staff email/password login', () => {
  const EMAIL = 'counter@example.com';
  const PASSWORD = 'correct-horse-battery';
  const post = (url: string, body: unknown, who?: string) => call('POST', url, who, body);

  it('admin creates a staff account that can log in and use staff routes', async () => {
    const created = await post('/admin/users/staff', { email: EMAIL, password: PASSWORD, name: 'Counter One' }, ADMIN);
    expect(created.status).toBe(201);
    expect(created.body.role).toBe('staff');
    expect(created.body.email).toBe(EMAIL);
    expect(created.body.phone).toBeNull();

    const login = await post('/auth/password-login', { email: 'Counter@Example.com', password: PASSWORD });
    expect(login.status).toBe(200);
    tokens[EMAIL] = login.body.token;
    expect((await call('GET', '/staff/orders?scope=open', EMAIL)).status).toBe(200);
    expect((await call('GET', '/admin/users', EMAIL)).status).toBe(403);
  });

  it('rejects duplicates, wrong passwords and unknown emails with the same message', async () => {
    expect((await post('/admin/users/staff', { email: EMAIL, password: PASSWORD, name: 'Dup' }, ADMIN)).status).toBe(409);
    const wrong = await post('/auth/password-login', { email: EMAIL, password: 'nope-nope-nope' });
    const unknown = await post('/auth/password-login', { email: 'ghost@example.com', password: PASSWORD });
    expect(wrong.status).toBe(401);
    expect(unknown.status).toBe(401);
    expect(wrong.body.message).toBe(unknown.body.message);
  });

  it('refuses students, blocked staff, and non-admins creating accounts', async () => {
    const student = await post('/admin/users/staff', { email: 'kid@example.com', password: PASSWORD, name: 'Kid', role: 'staff' }, ADMIN);
    await call('PATCH', `/admin/users/${student.body.id}`, ADMIN, { role: 'student' });
    expect((await post('/auth/password-login', { email: 'kid@example.com', password: PASSWORD })).status).toBe(403);

    const staff = await call('GET', `/admin/users?q=${EMAIL}`, ADMIN);
    const id = staff.body[0].id;
    await call('PATCH', `/admin/users/${id}`, ADMIN, { isBlocked: true });
    expect((await post('/auth/password-login', { email: EMAIL, password: PASSWORD })).status).toBe(403);
    await call('PATCH', `/admin/users/${id}`, ADMIN, { isBlocked: false });

    expect((await post('/admin/users/staff', { email: 'x@example.com', password: PASSWORD, name: 'X' }, ALICE)).status).toBe(403);
  });

  it('admin can reset the password', async () => {
    const id = (await call('GET', `/admin/users?q=${EMAIL}`, ADMIN)).body[0].id;
    expect((await call('PATCH', `/admin/users/${id}`, ADMIN, { password: 'brand-new-password' })).status).toBe(200);
    expect((await post('/auth/password-login', { email: EMAIL, password: PASSWORD })).status).toBe(401);
    expect((await post('/auth/password-login', { email: EMAIL, password: 'brand-new-password' })).status).toBe(200);
  });

  it('rate limits repeated failures', async () => {
    let last = 0;
    for (let i = 0; i < 7; i++) last = (await post('/auth/password-login', { email: 'brute@example.com', password: 'x' + i })).status;
    expect(last).toBe(429);
  });
});
