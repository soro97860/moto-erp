import { Router } from 'express';
import { prisma } from '../lib/prisma';
import { authenticate, requireRole } from '../middleware/auth';

export const settingsRouter = Router();
settingsRouter.use(authenticate);

const ALLOWED_KEYS = new Set([
  'shopName', 'shopAddress', 'shopPhone', 'shopTaxId',
  'shopWarranty', 'shopThankYou', 'lowStockThreshold',
]);

// GET /settings  → { shopName: '...', shopAddress: '...', ... }
settingsRouter.get('/', async (_req, res) => {
  const rows = await prisma.settings.findMany();
  const result: Record<string, string> = {};
  for (const row of rows) result[row.key] = row.value;
  res.json({ success: true, data: result });
});

// PUT /settings  → upsert multiple keys (ADMIN only)
settingsRouter.put('/', requireRole('ADMIN'), async (req, res) => {
  const payload = req.body as Record<string, string>;
  const entries = Object.entries(payload).filter(([k]) => ALLOWED_KEYS.has(k));

  await prisma.$transaction(
    entries.map(([key, value]) =>
      prisma.settings.upsert({
        where: { key },
        update: { value: String(value) },
        create: { key, value: String(value) },
      }),
    ),
  );

  res.json({ success: true });
});
