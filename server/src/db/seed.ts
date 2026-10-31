// Seeds categories, a starter menu (items from the design chart + placeholders) and default settings.
// Safe to run more than once. Replace the menu with the real canteen menu from the admin dashboard.
import { eq } from 'drizzle-orm';
import { db, pool } from './index.js';
import { categories, comboItems, combos, menuItems, settings } from './schema.js';
import { DEFAULT_SETTINGS } from '../lib/settings.js';

const rs = (rupees: number) => Math.round(rupees * 100);

const CATEGORIES = [
  { name: 'Snacks', icon: 'snack', sortOrder: 1 },
  { name: 'Meals', icon: 'meal', sortOrder: 2 },
  { name: 'Drinks', icon: 'drink', sortOrder: 3 },
  { name: 'Combos', icon: 'combo', sortOrder: 4 },
  { name: 'Healthy', icon: 'healthy', sortOrder: 5 },
  { name: 'Desserts', icon: 'dessert', sortOrder: 6 },
];

// [category, name, price ₹, prep minutes, popular]
const ITEMS: [string, string, number, number, boolean][] = [
  ['Snacks', 'Veg Burger', 50, 8, true],
  ['Snacks', 'Paneer Roll', 80, 10, true],
  ['Snacks', 'Samosa', 30, 3, true],
  ['Snacks', 'French Fries', 60, 8, false],
  ['Meals', 'Veg Thali', 90, 5, false],
  ['Meals', 'Rajma Chawal', 70, 5, false],
  ['Drinks', 'Cold Coffee', 60, 4, true],
  ['Drinks', 'Masala Chai', 15, 3, false],
  ['Drinks', 'Fresh Lime Soda', 40, 3, false],
  ['Healthy', 'Fruit Bowl', 50, 4, false],
  ['Healthy', 'Sprouts Chaat', 40, 4, false],
  ['Desserts', 'Gulab Jamun (2 pc)', 30, 2, false],
];

export async function seed() {
  for (const c of CATEGORIES) {
    await db.insert(categories).values(c).onDuplicateKeyUpdate({ set: { name: c.name } });
  }
  const cats = Object.fromEntries((await db.select().from(categories)).map((c) => [c.name, c.id]));

  for (const [cat, name, price, prep, popular] of ITEMS) {
    const [exists] = await db.select({ id: menuItems.id }).from(menuItems).where(eq(menuItems.name, name));
    if (!exists) {
      await db.insert(menuItems).values({
        categoryId: cats[cat],
        name,
        pricePaise: rs(price),
        prepMinutes: prep,
        isPopular: popular,
      });
    }
  }

  const [anyCombo] = await db.select({ id: combos.id }).from(combos).limit(1);
  if (!anyCombo) {
    const byName = async (n: string) =>
      (await db.select({ id: menuItems.id }).from(menuItems).where(eq(menuItems.name, n)))[0].id;
    const combosToAdd: [string, string, number, string[]][] = [
      ['Burger + Cold Coffee', 'Student combo', 99, ['Veg Burger', 'Cold Coffee']],
      ['Samosa + Chai', 'Quick break combo', 40, ['Samosa', 'Masala Chai']],
    ];
    for (const [name, description, price, parts] of combosToAdd) {
      const [res] = await db.insert(combos).values({ name, description, pricePaise: rs(price) });
      for (const p of parts) {
        await db.insert(comboItems).values({ comboId: res.insertId, menuItemId: await byName(p) });
      }
    }
  }

  for (const [key, value] of Object.entries(DEFAULT_SETTINGS)) {
    await db.insert(settings).values({ key, value }).onDuplicateKeyUpdate({ set: { key } });
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  await seed();
  console.log('Seed complete');
  await pool.end();
}
