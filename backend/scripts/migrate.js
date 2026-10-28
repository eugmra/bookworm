import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { pool } from '../src/db.js';

const sql = await readFile(fileURLToPath(new URL('../db/schema.sql', import.meta.url)), 'utf8');
await pool.query(sql);
process.stdout.write(JSON.stringify({ level: 'info', msg: 'Schema applied' }) + '\n');
await pool.end();
