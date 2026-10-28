import { Router } from 'express';
import { z } from 'zod';
import { query } from '../db.js';
import { validate } from '../middleware/validate.js';
import { requireRole } from '../middleware/auth.js';
import { getStore } from '../services/checkout.js';

const router = Router();

router.get('/store', async (_req, res) => {
  const s = await getStore({ query });
  res.json({
    store: {
      name: s.name,
      taxPercent: s.tax_percent,
      deliveryChargePaise: s.delivery_charge_paise,
      freeDeliveryAbovePaise: s.free_delivery_above_paise,
      cancelWindowHours: s.cancel_window_hours,
      pointValuePaise: s.point_value_paise,
    },
  });
});

const catalogSchema = z.object({
  title: z.string().trim().min(1).max(200),
  authorId: z.number().int().positive(),
  brandId: z.number().int().positive(),
  categoryId: z.number().int().positive(),
  kind: z.enum(['Fiction', 'Non-Fiction']),
  tagline: z.string().trim().max(300).default(''),
  description: z.string().trim().max(2000).default(''),
  format: z.enum(['Paperback', 'Hardcover', 'eBook']),
  language: z.string().trim().min(1).max(40).default('English'),
  pricePaise: z.number().int().min(100).max(10_000_000),
  stock: z.number().int().min(0).max(100000),
  deliveryDays: z.number().int().min(0).max(60).default(3),
});

// Store management: only admins can add to the catalogue.
router.post('/store/books', requireRole('admin'), validate(catalogSchema), async (req, res) => {
  const b = req.valid.body;
  const { rows } = await query(
    `INSERT INTO books (title, author_id, brand_id, category_id, kind, tagline, description, format, language,
                        price_paise, stock, delivery_days)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) RETURNING id`,
    [b.title, b.authorId, b.brandId, b.categoryId, b.kind, b.tagline, b.description, b.format, b.language, b.pricePaise, b.stock, b.deliveryDays],
  );
  res.status(201).json({ id: rows[0].id });
});

export default router;
