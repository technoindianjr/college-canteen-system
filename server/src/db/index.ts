import { drizzle } from 'drizzle-orm/mysql2';
import mysql from 'mysql2/promise';
import { config } from '../config.js';
import * as schema from './schema.js';

export const pool = mysql.createPool({
  uri: config.DATABASE_URL,
  connectionLimit: 10,
  timezone: 'Z', // store and read all DATETIME/TIMESTAMP values as UTC
  dateStrings: ['DATE'],
});

export const db = drizzle(pool, { schema, mode: 'default' });
export type DB = typeof db;
export { schema };
