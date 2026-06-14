import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { authenticate, requireRole } from '../middleware/auth';
import { AppError } from '../middleware/errorHandler';
import { storageLocationSchema } from '@moto-erp/shared';

export const storageLocationRouter = Router();
storageLocationRouter.use(authenticate);

storageLocationRouter.get('/', async (_req, res) => {
  const locations = await prisma.storageLocation.findMany({
    orderBy: [{ floor: 'asc' }, { cabinet: 'asc' }, { shelf: 'asc' }],
    include: { _count: { select: { products: true } } },
  });
  res.json({ success: true, data: locations });
});

// Batch create — must be registered before /:id to avoid route conflict
storageLocationRouter.post('/batch', requireRole('ADMIN'), async (req, res) => {
  const batchSchema = z.object({
    locations: z.array(storageLocationSchema).min(1).max(200),
  });
  const { locations } = batchSchema.parse(req.body);
  const result = await prisma.storageLocation.createMany({
    data: locations,
    skipDuplicates: true,
  });
  res.status(201).json({ success: true, data: result });
});

storageLocationRouter.post('/', requireRole('ADMIN'), async (req, res) => {
  const data = storageLocationSchema.parse(req.body);
  const location = await prisma.storageLocation.create({ data });
  res.status(201).json({ success: true, data: location });
});

storageLocationRouter.put('/:id', requireRole('ADMIN'), async (req, res) => {
  const data = storageLocationSchema.parse(req.body);
  const location = await prisma.storageLocation.update({ where: { id: req.params.id }, data });
  res.json({ success: true, data: location });
});

storageLocationRouter.delete('/:id', requireRole('ADMIN'), async (req, res) => {
  const count = await prisma.product.count({ where: { storageLocationId: req.params.id } });
  if (count > 0) throw new AppError(`此儲位有 ${count} 項商品，請先移除商品儲位再刪除`, 400);
  await prisma.storageLocation.delete({ where: { id: req.params.id } });
  res.json({ success: true });
});
