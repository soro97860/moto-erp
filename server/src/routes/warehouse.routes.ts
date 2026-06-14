import { Router } from 'express';
import { prisma } from '../lib/prisma';
import { authenticate, requireRole } from '../middleware/auth';
import { stockInSchema, storageLocationSchema } from '@moto-erp/shared';
import { AppError } from '../middleware/errorHandler';
import { parsePagination, paginated } from '../utils/pagination';

export const warehouseRouter = Router();
warehouseRouter.use(authenticate);

// ── POST /stock-in ────────────────────────────────────────────
// Increase stock for a product and record the movement
warehouseRouter.post('/stock-in', async (req, res) => {
  const body = stockInSchema.parse(req.body);
  const operatorId = req.user!.userId;

  const product = await prisma.product.findFirst({
    where: { id: body.productId, isActive: true },
  });
  if (!product) throw new AppError('商品不存在', 404);

  const qtyBefore = product.stockQty;
  const qtyAfter = qtyBefore + body.qty;

  const [movement] = await prisma.$transaction([
    prisma.stockMovement.create({
      data: {
        productId: body.productId,
        type: 'IN',
        qty: body.qty,
        qtyBefore,
        qtyAfter,
        reason: body.reason ?? '手動入庫',
        operatorId,
      },
      include: {
        product: { select: { id: true, sku: true, name: true, unit: true } },
        operator: { select: { id: true, name: true } },
      },
    }),
    prisma.product.update({
      where: { id: body.productId },
      data: {
        stockQty: qtyAfter,
        // Update storageLocation if provided
        ...(body.storageLocationId ? { storageLocationId: body.storageLocationId } : {}),
      },
    }),
  ]);

  res.status(201).json({ success: true, data: movement });
});

// ── GET /movements ────────────────────────────────────────────
// ?productId=&type=IN|OUT|ADJUSTMENT&from=&to=&page=&pageSize=
warehouseRouter.get('/movements', async (req, res) => {
  const { page, pageSize, skip, take } = parsePagination(req.query as Record<string, unknown>);
  const { productId, type, from, to } = req.query as Record<string, string | undefined>;

  const where: Record<string, unknown> = {};
  if (productId) where.productId = productId;
  if (type) where.type = type;
  if (from || to) {
    const createdAt: Record<string, Date> = {};
    if (from) {
      const d = new Date(from);
      if (isNaN(d.getTime())) throw new AppError('from 日期格式無效', 400);
      createdAt.gte = d;
    }
    if (to) {
      const d = new Date(to);
      if (isNaN(d.getTime())) throw new AppError('to 日期格式無效', 400);
      createdAt.lte = new Date(d.setHours(23, 59, 59, 999));
    }
    where.createdAt = createdAt;
  }

  const [items, total] = await Promise.all([
    prisma.stockMovement.findMany({
      where,
      include: {
        product: { select: { id: true, sku: true, name: true, unit: true } },
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

// ── GET /locations ────────────────────────────────────────────
warehouseRouter.get('/locations', async (req, res) => {
  const { search } = req.query as { search?: string };

  const where = search
    ? {
        OR: [
          { floor: { contains: search, mode: 'insensitive' as const } },
          { cabinet: { contains: search, mode: 'insensitive' as const } },
          { shelf: { contains: search, mode: 'insensitive' as const } },
          { note: { contains: search, mode: 'insensitive' as const } },
        ],
      }
    : undefined;

  const locations = await prisma.storageLocation.findMany({
    where,
    include: {
      _count: { select: { products: true } },
    },
    orderBy: [{ floor: 'asc' }, { cabinet: 'asc' }, { shelf: 'asc' }],
  });

  res.json({ success: true, data: locations });
});

// ── POST /locations ───────────────────────────────────────────
warehouseRouter.post('/locations', requireRole('ADMIN'), async (req, res) => {
  const data = storageLocationSchema.parse(req.body);
  const location = await prisma.storageLocation.create({ data });
  res.status(201).json({ success: true, data: location });
});

// ── PUT /locations/:id ────────────────────────────────────────
warehouseRouter.put('/locations/:id', requireRole('ADMIN'), async (req, res) => {
  const data = storageLocationSchema.parse(req.body);
  const location = await prisma.storageLocation.update({
    where: { id: req.params.id },
    data,
  });
  res.json({ success: true, data: location });
});

// ── GET /low-stock ────────────────────────────────────────────
// Returns products where stockQty <= minStockQty (or <= threshold query param)
warehouseRouter.get('/low-stock', async (req, res) => {
  const threshold =
    req.query.threshold !== undefined ? Number(req.query.threshold) : undefined;

  // Fetch all active products — compare stockQty vs minStockQty in-memory
  // For very large catalogues swap to $queryRaw with column comparison
  const all = await prisma.product.findMany({
    where: { isActive: true },
    include: {
      brand: { select: { id: true, name: true } },
      category: { select: { id: true, name: true } },
      storageLocation: true,
    },
    orderBy: { stockQty: 'asc' },
  });

  const lowStock =
    threshold !== undefined && !isNaN(threshold)
      ? all.filter((p) => p.stockQty <= threshold)
      : all.filter((p) => p.stockQty <= p.minStockQty);

  res.json({
    success: true,
    data: {
      total: lowStock.length,
      threshold: threshold ?? null,
      items: lowStock,
    },
  });
});
