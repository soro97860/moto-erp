import { Router } from 'express';
import { prisma } from '../lib/prisma';
import { authenticate, requireRole } from '../middleware/auth';
import { AppError } from '../middleware/errorHandler';
import { brandSchema } from '@moto-erp/shared';

export const brandRouter = Router();
brandRouter.use(authenticate);

brandRouter.get('/', async (_req, res) => {
  const brands = await prisma.brand.findMany({ orderBy: { name: 'asc' } });
  res.json({ success: true, data: brands });
});

brandRouter.post('/', requireRole('ADMIN'), async (req, res) => {
  const data = brandSchema.parse(req.body);
  const brand = await prisma.brand.create({ data });
  res.status(201).json({ success: true, data: brand });
});

brandRouter.put('/:id', requireRole('ADMIN'), async (req, res) => {
  const data = brandSchema.parse(req.body);
  const brand = await prisma.brand.update({ where: { id: req.params.id }, data });
  res.json({ success: true, data: brand });
});

brandRouter.delete('/:id', requireRole('ADMIN'), async (req, res) => {
  const count = await prisma.product.count({ where: { brandId: req.params.id } });
  if (count > 0) throw new AppError(`此廠牌已關聯 ${count} 項商品，請先移除商品廠牌再刪除`, 400);
  await prisma.brand.delete({ where: { id: req.params.id } });
  res.json({ success: true });
});
