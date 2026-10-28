import dotenv from 'dotenv';
import { z } from 'zod';

dotenv.config({ quiet: true });

const schema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  HOST: z
    .string()
    .default('127.0.0.1')
    .refine((h) => h !== '0.0.0.0' && h !== '::', 'Do not bind to all interfaces'),
  PORT: z.coerce.number().int().min(1).max(65535).default(4000),
  ALLOWED_ORIGINS: z.string().default(''),
  DB_HOST: z.string().min(1).default('127.0.0.1'),
  DB_PORT: z.coerce.number().int().min(1).max(65535).default(5432),
  DB_NAME: z.string().min(1),
  DB_USER: z.string().min(1),
  DB_PASSWORD: z.string().min(1),
  DB_SSL: z.enum(['true', 'false']).default('false'),
  JWT_SECRET: z.string().min(32),
  SESSION_HOURS: z.coerce.number().min(0.25).max(24).default(2),
  DEMO_USER_PASSWORD: z.string().min(12).optional(),
});

const parsed = schema.safeParse(process.env);
if (!parsed.success) {
  // Only field names are logged, never values (they may be secrets).
  process.stderr.write(
    JSON.stringify({
      level: 'error',
      msg: 'Invalid configuration',
      fields: parsed.error.issues.map((i) => i.path.join('.')),
    }) + '\n',
  );
  process.exit(1);
}

const env = parsed.data;

export const config = {
  env: env.NODE_ENV,
  isProd: env.NODE_ENV === 'production',
  host: env.HOST,
  port: env.PORT,
  allowedOrigins: env.ALLOWED_ORIGINS.split(',')
    .map((o) => o.trim())
    .filter(Boolean),
  db: {
    host: env.DB_HOST,
    port: env.DB_PORT,
    database: env.DB_NAME,
    user: env.DB_USER,
    password: env.DB_PASSWORD,
    ssl: env.DB_SSL === 'true',
  },
  jwtSecret: env.JWT_SECRET,
  sessionHours: env.SESSION_HOURS,
  demoUserPassword: env.DEMO_USER_PASSWORD,
};
