import { db } from '../db/index.js';
import { settings } from '../db/schema.js';

export const DEFAULT_SETTINGS = {
  orders_paused: 'false',
  open_time: '08:00', // local time (TIMEZONE, default Asia/Kolkata)
  close_time: '18:00',
  max_open_orders_per_student: '2',
  max_orders_per_10_min: '40',
  no_show_minutes: '30',
  no_show_block_after: '3',
} as const;

export type SettingKey = keyof typeof DEFAULT_SETTINGS;
export type Settings = Record<SettingKey, string>;

export async function getSettings(): Promise<Settings> {
  const rows = await db.select().from(settings);
  const out: Settings = { ...DEFAULT_SETTINGS };
  for (const r of rows) if (r.key in out) out[r.key as SettingKey] = r.value;
  return out;
}

export async function setSetting(key: SettingKey, value: string) {
  await db.insert(settings).values({ key, value }).onDuplicateKeyUpdate({ set: { value } });
}

export const num = (s: Settings, k: SettingKey) => Number(s[k]);
