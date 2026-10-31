import { buildApp } from './app.js';
import { config } from './config.js';
import { pool } from './db/index.js';
import { startJobs } from './jobs.js';
import { attachRealtime } from './lib/realtime.js';

const app = await buildApp();
attachRealtime(app, app.server);
startJobs(app.log);

await app.listen({ port: config.PORT, host: config.HOST });
if (config.AUTH_DEV_MODE) app.log.warn('AUTH_DEV_MODE is ON: "dev:+91..." tokens are accepted. Turn it off before going live.');

for (const sig of ['SIGINT', 'SIGTERM'] as const) {
  process.on(sig, async () => {
    await app.close();
    await pool.end();
    process.exit(0);
  });
}
