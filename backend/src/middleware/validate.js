import { ZodError } from 'zod';
import { AppError } from '../errors.js';
import { logger } from '../logger.js';

/** Validates req[source] with a zod schema and replaces it with the parsed (allow-listed) value. */
export function validate(schema, source = 'body') {
  return (req, _res, next) => {
    const result = schema.safeParse(req[source]);
    if (!result.success) {
      const details = result.error.issues.map((i) => ({ field: i.path.join('.'), message: i.message }));
      const err = new AppError(400, 'Validation failed', 'VALIDATION');
      err.details = details;
      return next(err);
    }
    // Express 5 makes req.query a getter; store parsed values on a separate property.
    req.valid = { ...(req.valid ?? {}), [source]: result.data };
    next();
  };
}

export function notFound(_req, _res, next) {
  next(new AppError(404, 'Not found'));
}

// eslint-disable-next-line no-unused-vars
export function errorHandler(err, req, res, _next) {
  if (err instanceof AppError) {
    return res.status(err.status).json({ error: err.message, code: err.code, details: err.details });
  }
  if (err instanceof ZodError) {
    return res.status(400).json({ error: 'Validation failed', code: 'VALIDATION' });
  }
  if (err?.type === 'entity.parse.failed' || err?.type === 'entity.too.large') {
    return res.status(400).json({ error: 'Invalid request body' });
  }
  // Unique violation (e.g. duplicate email) and similar constraint errors from Postgres
  if (err?.code === '23505') return res.status(409).json({ error: 'Already exists' });
  logger.error('Unhandled error', { path: req.path, method: req.method, error: err?.message, stack: err?.stack });
  res.status(500).json({ error: 'Internal server error' });
}
