import express from 'express';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import rateLimit from 'express-rate-limit';
import { config } from './config.js';
import { pool } from './db.js';
import { loadUser, originCheck } from './middleware/auth.js';
import { errorHandler, notFound } from './middleware/validate.js';
import authRoutes from './routes/auth.js';
import catalogRoutes from './routes/catalog.js';
import ordersRoutes from './routes/orders.js';
import accountRoutes from './routes/account.js';
import storeRoutes from './routes/store.js';

export function createApp() {
  const app = express();
  app.disable('x-powered-by');
  app.use(helmet());
  app.use(express.json({ limit: '50kb' }));
  app.use(cookieParser());

  app.get('/api/health', async (_req, res) => {
    try {
      await pool.query('SELECT 1');
      res.json({ status: 'ok' });
    } catch {
      res.status(503).json({ status: 'unavailable' });
    }
  });

  app.use(
    '/api',
    rateLimit({ windowMs: 60 * 1000, limit: 300, standardHeaders: true, legacyHeaders: false }),
    originCheck,
    loadUser,
  );

  app.use('/api/auth', authRoutes);
  app.use('/api', catalogRoutes);
  app.use('/api', ordersRoutes);
  app.use('/api/me', accountRoutes);
  app.use('/api', storeRoutes);

  app.use(notFound);
  app.use(errorHandler);
  return app;
}

export { config };
