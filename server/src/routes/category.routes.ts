import { Router } from 'express';
import { prisma } from '../lib/prisma';
import { authenticate, requireRole } from '../middleware/auth';
import { AppError } from '../middleware/errorHandler';
import { categorySchema } from '@moto-erp/shared';

export const categoryRouter = Router();
categoryRouter.use(authenticate);

categoryRouter.get('/', async (_req, res) => {
  const categories = await prisma.category.findMany({
    include: { children: true },
    where: { parentId: null },
    orderBy: { name: 'asc' },
  });
  res.json({ success: true, data: categories });
});

categoryRouter.post('/', requireRole('ADMIN'), async (req, res) => {
  const data = categorySchema.parse(req.body);
  const category = await prisma.category.create({ data });
  res.status(201).json({ success: true, data: category });
});

categoryRouter.put('/:id', requireRole('ADMIN'), async (req, res) => {
  const data = categorySchema.parse(req.body);
  const category = await prisma.category.update({ where: { id: req.params.id }, data });
  res.json({ success: true, data: category });
});

categoryRouter.delete('/:id', requireRole('ADMIN'), async (req, res) => {
  const [pCount, cCount] = await Promise.all([
    prisma.product.count({ where: { categoryId: req.params.id } }),
    prisma.category.count({ where: { parentId: req.params.id } }),
  ]);
  if (pCount > 0) throw new AppError(`此分類已關聯 ${pCount} 項商品，請先移除商品分類再刪除`, 400);
  if (cCount > 0) throw new AppError(`此分類有 ${cCount} 個子分類，請先刪除子分類`, 400);
  await prisma.category.delete({ where: { id: req.params.id } });
  res.json({ success: true });
});
