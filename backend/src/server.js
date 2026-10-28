import { createApp } from './app.js';
import { config } from './config.js';
import { pool } from './db.js';
import { logger } from './logger.js';

const app = createApp();
const server = app.listen(config.port, config.host, () => {
  logger.info('API listening', { host: config.host, port: config.port });
});
server.requestTimeout = 30000;

async function shutdown(signal) {
  logger.info('Shutting down', { signal });
  server.close(async () => {
    await pool.end().catch(() => {});
    process.exit(0);
  });
  setTimeout(() => process.exit(1), 10000).unref();
}
process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
