import cron from 'node-cron';
import type { FastifyBaseLogger } from 'fastify';
import { sweepNoShows } from './lib/orders.js';

/** Every minute: mark uncollected ready orders as no-show. */
export function startJobs(log: FastifyBaseLogger) {
  cron.schedule('* * * * *', async () => {
    try {
      const ids = await sweepNoShows();
      if (ids.length) log.info({ ids }, 'Marked no-show orders');
    } catch (err) {
      log.error(err, 'no-show sweep failed');
    }
  });
}
