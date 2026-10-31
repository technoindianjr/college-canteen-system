// Applies pending SQL migrations in ./drizzle. Run on the server after every pull: npm run db:migrate
import { migrate } from 'drizzle-orm/mysql2/migrator';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { db, pool } from './index.js';

const folder = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../drizzle');
await migrate(db, { migrationsFolder: folder });
console.log('Migrations applied');
await pool.end();
