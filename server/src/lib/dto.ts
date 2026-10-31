import type { combos, menuItems, users } from '../db/schema.js';

export const imageUrl = (p: string | null) => (p ? `/uploads/${p}` : null);

export const menuItemDto = (i: typeof menuItems.$inferSelect) => ({
  id: i.id,
  categoryId: i.categoryId,
  name: i.name,
  description: i.description,
  pricePaise: i.pricePaise,
  imageUrl: imageUrl(i.imagePath),
  isVeg: i.isVeg,
  isAvailable: i.isAvailable,
  isActive: i.isActive,
  isPopular: i.isPopular,
  prepMinutes: i.prepMinutes,
});

export const comboDto = (c: typeof combos.$inferSelect, parts: { menuItemId: number; name: string; qty: number }[]) => ({
  id: c.id,
  name: c.name,
  description: c.description,
  pricePaise: c.pricePaise,
  imageUrl: imageUrl(c.imagePath),
  isAvailable: c.isAvailable,
  isActive: c.isActive,
  items: parts,
});

export const userDto = (u: typeof users.$inferSelect) => ({
  id: u.id,
  phone: u.phone,
  name: u.name,
  rollNo: u.rollNo,
  role: u.role,
  isBlocked: u.isBlocked,
  noShowCount: u.noShowCount,
  profileComplete: Boolean(u.name),
  createdAt: u.createdAt,
});
