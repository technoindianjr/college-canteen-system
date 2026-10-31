// Recreates the test database from the migrations before the test run.
import mysql from 'mysql2/promise';
import { execSync } from 'node:child_process';

export default async function setup() {
  const url = new URL(process.env.TEST_DATABASE_URL ?? 'mysql://canteen:canteen@127.0.0.1:3306/canteen_test');
  const dbName = url.pathname.slice(1);
  const conn = await mysql.createConnection({ host: url.hostname, port: Number(url.port || 3306), user: url.username, password: url.password });
  await conn.query(`DROP DATABASE IF EXISTS \`${dbName}\``);
  await conn.query(`CREATE DATABASE \`${dbName}\``);
  await conn.end();
  const env = { ...process.env, DATABASE_URL: url.toString(), JWT_SECRET: 'test-secret-test-secret-test-secret', NODE_ENV: 'test' };
  execSync('npx tsx src/db/migrate.ts', { env, stdio: 'inherit' });
  execSync('npx tsx src/db/seed.ts', { env, stdio: 'inherit' });
}
