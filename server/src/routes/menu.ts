import type { FastifyPluginAsync } from 'fastify';
import { and, asc, eq, inArray, or } from 'drizzle-orm';
import { db } from '../db/index.js';
import { categories, comboItems, combos, dailySpecials, menuItems } from '../db/schema.js';
import { comboDto, menuItemDto } from '../lib/dto.js';
import { getSettings } from '../lib/settings.js';
import { isWithinHours, localDate } from '../lib/time.js';

export async function loadCombos(onlyActive: boolean) {
  const list = await db
    .select()
    .from(combos)
    .where(onlyActive ? eq(combos.isActive, true) : undefined)
    .orderBy(asc(combos.name));
  if (!list.length) return [];
  const parts = await db
    .select({ comboId: comboItems.comboId, menuItemId: comboItems.menuItemId, qty: comboItems.qty, name: menuItems.name, available: menuItems.isAvailable })
    .from(comboItems)
    .innerJoin(menuItems, eq(menuItems.id, comboItems.menuItemId))
    .where(inArray(comboItems.comboId, list.map((c) => c.id)));
  return list.map((c) => {
    const mine = parts.filter((p) => p.comboId === c.id);
    const dto = comboDto(c, mine.map(({ menuItemId, name, qty }) => ({ menuItemId, name, qty })));
    // A combo is sold out if any part is sold out
    return { ...dto, isAvailable: c.isAvailable && mine.every((p) => p.available) };
  });
}

const routes: FastifyPluginAsync = async (app) => {
  /** Everything the student home + menu screens need in one call. Public (no login). */
  app.get('/menu', async () => {
    const [cats, items, combosList, s] = await Promise.all([
      db.select().from(categories).where(eq(categories.isActive, true)).orderBy(asc(categories.sortOrder)),
      db.select().from(menuItems).where(eq(menuItems.isActive, true)).orderBy(asc(menuItems.name)),
      loadCombos(true),
      getSettings(),
    ]);

    const today = localDate();
    const specials = await db.select().from(dailySpecials).where(eq(dailySpecials.date, today));

    return {
      date: today,
      ordering: {
        paused: s.orders_paused === 'true',
        openTime: s.open_time,
        closeTime: s.close_time,
        isOpen: s.orders_paused !== 'true' && isWithinHours(s.open_time, s.close_time),
      },
      categories: cats.map((c) => ({
        id: c.id,
        name: c.name,
        icon: c.icon,
        items: items.filter((i) => i.categoryId === c.id).map(menuItemDto),
      })),
      combos: combosList,
      popularItemIds: items.filter((i) => i.isPopular).map((i) => i.id),
      specials: specials.map((sp) => ({ id: sp.id, title: sp.title, menuItemId: sp.menuItemId, comboId: sp.comboId })),
    };
  });
};

export default routes;
