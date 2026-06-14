import { Router } from 'express';
import { prisma } from '../lib/prisma';
import { authenticate } from '../middleware/auth';
import { stockMovementSchema } from '@moto-erp/shared';
import { AppError } from '../middleware/errorHandler';
import { parsePagination, paginated } from '../utils/pagination';

export const stockRouter = Router();
stockRouter.use(authenticate);

stockRouter.get('/movements', async (req, res) => {
  const { page, pageSize, skip, take } = parsePagination(req.query as Record<string, unknown>);
  const productId = req.query.productId as string | undefined;

  const where = productId ? { productId } : undefined;
  const [items, total] = await Promise.all([
    prisma.stockMovement.findMany({
      where,
      include: {
        product: { select: { id: true, name: true, sku: true } },
        operator: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: 'desc' },
      skip,
      take,
    }),
    prisma.stockMovement.count({ where }),
  ]);

  res.json({ success: true, data: paginated(items, total, page, pageSize) });
});

stockRouter.post('/movements', async (req, res) => {
  const body = stockMovementSchema.parse(req.body);

  const product = await prisma.product.findUniqueOrThrow({ where: { id: body.productId } });

  if (body.type === 'OUT' && product.stockQty + body.qty < 0) {
    throw new AppError('Insufficient stock', 400);
  }

  const qtyBefore = product.stockQty;
  const qtyAfter = qtyBefore + body.qty;

  const [movement] = await prisma.$transaction([
    prisma.stockMovement.create({
      data: {
        productId: body.productId,
        type: body.type,
        qty: body.qty,
        qtyBefore,
        qtyAfter,
        reason: body.reason,
        operatorId: body.operatorId,
      },
      include: {
        product: { select: { id: true, name: true, sku: true } },
        operator: { select: { id: true, name: true } },
      },
    }),
    prisma.product.update({ where: { id: body.productId }, data: { stockQty: qtyAfter } }),
  ]);

  res.status(201).json({ success: true, data: movement });
});
