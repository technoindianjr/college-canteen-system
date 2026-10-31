import type { FastifyPluginAsync } from 'fastify';
import { pool } from '../db/index.js';

const routes: FastifyPluginAsync = async (app) => {
  /** For the uptime monitor. 200 only when MySQL answers. */
  app.get('/health', async (_req, reply) => {
    try {
      await pool.query('SELECT 1');
      return { ok: true, time: new Date().toISOString() };
    } catch {
      return reply.code(503).send({ ok: false });
    }
  });
};

export default routes;
