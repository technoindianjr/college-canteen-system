// Campus Canteen — MySQL schema (Drizzle ORM).
// v1: pay at the counter. The `payments` table and `pending_payment` status are for phase 2 (Razorpay).
// Money is always stored as integer paise (₹50 = 5000). Timestamps are stored in UTC.
import { relations } from 'drizzle-orm';
import {
  boolean,
  char,
  date,
  datetime,
  index,
  int,
  mysqlEnum,
  mysqlTable,
  primaryKey,
  timestamp,
  varchar,
} from 'drizzle-orm/mysql-core';

export const ROLES = ['student', 'staff', 'admin'] as const;
export const ORDER_STATUSES = [
  'pending_payment', // phase 2 only
  'placed',
  'preparing',
  'ready',
  'picked_up',
  'cancelled',
  'rejected',
  'no_show',
] as const;
export const PAYMENT_METHODS = ['cash', 'upi_counter', 'razorpay'] as const;
export const PAYMENT_STATUSES = ['unpaid', 'paid', 'refunded'] as const;

export type Role = (typeof ROLES)[number];
export type OrderStatus = (typeof ORDER_STATUSES)[number];
export type PaymentMethod = (typeof PAYMENT_METHODS)[number];

const createdAt = () => timestamp('created_at').notNull().defaultNow();
const updatedAt = () => timestamp('updated_at').notNull().defaultNow().onUpdateNow();

export const users = mysqlTable('users', {
  id: int('id').autoincrement().primaryKey(),
  phone: varchar('phone', { length: 16 }).unique(), // null for email/password staff
  email: varchar('email', { length: 255 }).unique(), // staff/admin web console login
  passwordHash: varchar('password_hash', { length: 255 }),
  firebaseUid: varchar('firebase_uid', { length: 128 }).unique(),
  name: varchar('name', { length: 80 }),
  rollNo: varchar('roll_no', { length: 32 }),
  role: mysqlEnum('role', ROLES).notNull().default('student'),
  fcmToken: varchar('fcm_token', { length: 255 }),
  isBlocked: boolean('is_blocked').notNull().default(false),
  noShowCount: int('no_show_count').notNull().default(0),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

export const categories = mysqlTable('categories', {
  id: int('id').autoincrement().primaryKey(),
  name: varchar('name', { length: 40 }).notNull().unique(),
  icon: varchar('icon', { length: 40 }),
  sortOrder: int('sort_order').notNull().default(0),
  isActive: boolean('is_active').notNull().default(true),
});

export const menuItems = mysqlTable(
  'menu_items',
  {
    id: int('id').autoincrement().primaryKey(),
    categoryId: int('category_id')
      .notNull()
      .references(() => categories.id),
    name: varchar('name', { length: 80 }).notNull(),
    description: varchar('description', { length: 255 }),
    pricePaise: int('price_paise').notNull(),
    imagePath: varchar('image_path', { length: 255 }),
    isVeg: boolean('is_veg').notNull().default(true),
    isAvailable: boolean('is_available').notNull().default(true), // staff sold-out toggle
    isActive: boolean('is_active').notNull().default(true), // admin hide/show
    isPopular: boolean('is_popular').notNull().default(false),
    prepMinutes: int('prep_minutes').notNull().default(10),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index('menu_items_category_idx').on(t.categoryId)],
);

export const combos = mysqlTable('combos', {
  id: int('id').autoincrement().primaryKey(),
  name: varchar('name', { length: 80 }).notNull(),
  description: varchar('description', { length: 255 }),
  pricePaise: int('price_paise').notNull(),
  imagePath: varchar('image_path', { length: 255 }),
  isAvailable: boolean('is_available').notNull().default(true),
  isActive: boolean('is_active').notNull().default(true),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

export const comboItems = mysqlTable(
  'combo_items',
  {
    comboId: int('combo_id')
      .notNull()
      .references(() => combos.id, { onDelete: 'cascade' }),
    menuItemId: int('menu_item_id')
      .notNull()
      .references(() => menuItems.id),
    qty: int('qty').notNull().default(1),
  },
  (t) => [primaryKey({ columns: [t.comboId, t.menuItemId] })],
);

export const dailySpecials = mysqlTable(
  'daily_specials',
  {
    id: int('id').autoincrement().primaryKey(),
    date: date('date', { mode: 'string' }).notNull(), // YYYY-MM-DD, Asia/Kolkata
    menuItemId: int('menu_item_id').references(() => menuItems.id),
    comboId: int('combo_id').references(() => combos.id),
    title: varchar('title', { length: 80 }),
  },
  (t) => [index('daily_specials_date_idx').on(t.date)],
);

export const orders = mysqlTable(
  'orders',
  {
    id: int('id').autoincrement().primaryKey(),
    userId: int('user_id')
      .notNull()
      .references(() => users.id),
    status: mysqlEnum('status', ORDER_STATUSES).notNull().default('placed'),
    totalPaise: int('total_paise').notNull(),
    pickupCode: char('pickup_code', { length: 4 }).notNull(),
    paymentMethod: mysqlEnum('payment_method', PAYMENT_METHODS),
    paymentStatus: mysqlEnum('payment_status', PAYMENT_STATUSES).notNull().default('unpaid'),
    note: varchar('note', { length: 255 }),
    rejectReason: varchar('reject_reason', { length: 255 }),
    readyBy: datetime('ready_by'),
    acceptedAt: datetime('accepted_at'),
    readyAt: datetime('ready_at'),
    closedAt: datetime('closed_at'),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    index('orders_status_created_idx').on(t.status, t.createdAt),
    index('orders_user_created_idx').on(t.userId, t.createdAt),
  ],
);

export const orderItems = mysqlTable(
  'order_items',
  {
    id: int('id').autoincrement().primaryKey(),
    orderId: int('order_id')
      .notNull()
      .references(() => orders.id, { onDelete: 'cascade' }),
    menuItemId: int('menu_item_id').references(() => menuItems.id),
    comboId: int('combo_id').references(() => combos.id),
    name: varchar('name', { length: 80 }).notNull(), // snapshot at order time
    qty: int('qty').notNull(),
    unitPricePaise: int('unit_price_paise').notNull(), // snapshot at order time
    note: varchar('note', { length: 120 }),
  },
  (t) => [index('order_items_order_idx').on(t.orderId)],
);

// Phase 2 (Razorpay on the vendor's account). Unused in v1.
export const payments = mysqlTable(
  'payments',
  {
    id: int('id').autoincrement().primaryKey(),
    orderId: int('order_id')
      .notNull()
      .references(() => orders.id),
    razorpayOrderId: varchar('razorpay_order_id', { length: 64 }).unique(),
    razorpayPaymentId: varchar('razorpay_payment_id', { length: 64 }).unique(),
    status: mysqlEnum('status', PAYMENT_STATUSES).notNull().default('unpaid'),
    amountPaise: int('amount_paise').notNull(),
    refundId: varchar('refund_id', { length: 64 }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index('payments_order_idx').on(t.orderId)],
);

export const feedback = mysqlTable('feedback', {
  id: int('id').autoincrement().primaryKey(),
  orderId: int('order_id')
    .notNull()
    .unique()
    .references(() => orders.id, { onDelete: 'cascade' }),
  rating: int('rating').notNull(), // 1-5
  comment: varchar('comment', { length: 500 }),
  createdAt: createdAt(),
});

// Key/value settings: ordering paused, opening hours, limits.
export const settings = mysqlTable('settings', {
  key: varchar('key', { length: 64 }).primaryKey(),
  value: varchar('value', { length: 255 }).notNull(),
});

// ---- relations (for db.query.* with `with`) ----
export const usersRelations = relations(users, ({ many }) => ({ orders: many(orders) }));
export const categoriesRelations = relations(categories, ({ many }) => ({ items: many(menuItems) }));
export const menuItemsRelations = relations(menuItems, ({ one }) => ({
  category: one(categories, { fields: [menuItems.categoryId], references: [categories.id] }),
}));
export const combosRelations = relations(combos, ({ many }) => ({ items: many(comboItems) }));
export const comboItemsRelations = relations(comboItems, ({ one }) => ({
  combo: one(combos, { fields: [comboItems.comboId], references: [combos.id] }),
  menuItem: one(menuItems, { fields: [comboItems.menuItemId], references: [menuItems.id] }),
}));
export const ordersRelations = relations(orders, ({ one, many }) => ({
  user: one(users, { fields: [orders.userId], references: [users.id] }),
  items: many(orderItems),
  feedback: one(feedback, { fields: [orders.id], references: [feedback.orderId] }),
}));
export const orderItemsRelations = relations(orderItems, ({ one }) => ({
  order: one(orders, { fields: [orderItems.orderId], references: [orders.id] }),
}));
export const feedbackRelations = relations(feedback, ({ one }) => ({
  order: one(orders, { fields: [feedback.orderId], references: [orders.id] }),
}));
