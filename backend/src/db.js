import pg from 'pg';
import { config } from './config.js';

// date -> 'YYYY-MM-DD' string, bigint -> number, numeric -> number
pg.types.setTypeParser(1082, (v) => v);
pg.types.setTypeParser(20, (v) => Number.parseInt(v, 10));
pg.types.setTypeParser(1700, (v) => Number.parseFloat(v));

export const pool = new pg.Pool({
  host: config.db.host,
  port: config.db.port,
  database: config.db.database,
  user: config.db.user,
  password: config.db.password,
  ssl: config.db.ssl ? { rejectUnauthorized: true } : false,
  max: 10,
  connectionTimeoutMillis: 5000,
  idleTimeoutMillis: 30000,
  statement_timeout: 15000,
});

export const query = (text, params) => pool.query(text, params);

export async function withTx(fn) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    throw err;
  } finally {
    client.release();
  }
}
