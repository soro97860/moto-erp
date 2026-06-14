import express, { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { authenticate, requireRole } from '../middleware/auth';
import { productSchema, importProductRowSchema } from '@moto-erp/shared';
import { AppError } from '../middleware/errorHandler';
import { parseCSV } from '../utils/csv';
import { parsePagination, paginated } from '../utils/pagination';

export const productRouter = Router();
productRouter.use(authenticate);

// ── GET / ─────────────────────────────────────────────────────
// ?keyword=&brand=<id>&category=<id>&page=&pageSize=
productRouter.get('/', async (req, res) => {
  const { page, pageSize, skip, take } = parsePagination(req.query as Record<string, unknown>);
  const { keyword, brand, category } = req.query as Record<string, string | undefined>;

  const where: Record<string, unknown> = { isActive: true };

  if (keyword) {
    where.OR = [
      { name: { contains: keyword, mode: 'insensitive' } },
      { sku: { contains: keyword, mode: 'insensitive' } },
      { barcode: { contains: keyword, mode: 'insensitive' } },
    ];
  }
  if (brand) where.brandId = brand;
  if (category) where.categoryId = category;

  const [items, total] = await Promise.all([
    prisma.product.findMany({
      where,
      include: {
        brand: { select: { id: true, name: true } },
        category: { select: { id: true, name: true } },
        storageLocation: true,
      },
      orderBy: { name: 'asc' },
      skip,
      take,
    }),
    prisma.product.count({ where }),
  ]);

  res.json({ success: true, data: paginated(items, total, page, pageSize) });
});

// ── GET /barcode/:code ────────────────────────────────────────
productRouter.get('/barcode/:code', async (req, res) => {
  const product = await prisma.product.findFirst({
    where: { barcode: req.params.code, isActive: true },
    include: {
      brand: { select: { id: true, name: true } },
      category: { select: { id: true, name: true } },
      storageLocation: true,
    },
  });
  if (!product) throw new AppError('找不到條碼對應商品', 404);
  res.json({ success: true, data: product });
});

// ── GET /:id ──────────────────────────────────────────────────
productRouter.get('/:id', async (req, res) => {
  const product = await prisma.product.findFirstOrThrow({
    where: { id: req.params.id, isActive: true },
    include: {
      brand: { select: { id: true, name: true } },
      category: { select: { id: true, name: true } },
      storageLocation: true,
    },
  });
  res.json({ success: true, data: product });
});

// ── POST / ────────────────────────────────────────────────────
productRouter.post('/', requireRole('ADMIN', 'MECHANIC'), async (req, res) => {
  const data = productSchema.parse(req.body);
  const product = await prisma.product.create({ data });
  res.status(201).json({ success: true, data: product });
});

// ── PUT /:id ──────────────────────────────────────────────────
productRouter.put('/:id', requireRole('ADMIN', 'MECHANIC'), async (req, res) => {
  const data = productSchema.parse(req.body);
  const product = await prisma.product.update({ where: { id: req.params.id }, data });
  res.json({ success: true, data: product });
});

// ── DELETE /:id ───────────────────────────────────────────────
productRouter.delete('/:id', requireRole('ADMIN'), async (req, res) => {
  await prisma.product.update({ where: { id: req.params.id }, data: { isActive: false } });
  res.json({ success: true });
});

// ── POST /import ──────────────────────────────────────────────
// Accepts JSON body:  { items: ImportProductRow[] }
// Accepts CSV body:   sku,name,barcode,brandName,categoryName,sellPrice,costPrice,stockQty,minStockQty,unit,note
productRouter.post(
  '/import',
  express.text({ type: ['text/csv', 'text/plain'] }),
  requireRole('ADMIN'),
  async (req, res) => {
    const operatorId = req.user!.userId;

    // ── Parse input ───────────────────────────────────────────
    let rawRows: unknown[];
    const ct = req.headers['content-type'] ?? '';

    if (ct.startsWith('text/csv') || ct.startsWith('text/plain')) {
      rawRows = parseCSV(req.body as string);
    } else {
      const body = z.object({ items: z.array(z.unknown()).min(1) }).parse(req.body);
      rawRows = body.items;
    }

    const rows = z.array(importProductRowSchema).min(1).max(500).parse(rawRows);

    // ── Resolve brand/category names to IDs (create if missing) ──
    const uniqueBrandNames = [...new Set(rows.map((r) => r.brandName).filter(Boolean) as string[])];
    const uniqueCategoryNames = [
      ...new Set(rows.map((r) => r.categoryName).filter(Boolean) as string[]),
    ];

    const brandMap = new Map<string, string>();
    for (const name of uniqueBrandNames) {
      const brand = await prisma.brand.upsert({
        where: { name },
        update: {},
        create: { name },
      });
      brandMap.set(name, brand.id);
    }

    const categoryMap = new Map<string, string>();
    for (const name of uniqueCategoryNames) {
      const cat = await prisma.category.upsert({
        where: { name_parentId: { name, parentId: null as unknown as string } },
        update: {},
        create: { name },
      });
      categoryMap.set(name, cat.id);
    }

    // ── Upsert products and seed initial stock movements ─────
    const results = await prisma.$transaction(async (tx) => {
      const created: string[] = [];
      const updated: string[] = [];

      for (const row of rows) {
        const existing = await tx.product.findUnique({ where: { sku: row.sku } });

        const productData = {
          name: row.name,
          barcode: row.barcode ?? null,
          brandId: row.brandName ? (brandMap.get(row.brandName) ?? null) : null,
          categoryId: row.categoryName ? (categoryMap.get(row.categoryName) ?? null) : null,
          sellPrice: row.sellPrice,
          costPrice: row.costPrice,
          stockQty: row.stockQty,
          minStockQty: row.minStockQty,
          unit: row.unit,
          note: row.note ?? null,
          isActive: true,
        };

        if (existing) {
          const qtyDelta = row.stockQty - existing.stockQty;
          await tx.product.update({ where: { sku: row.sku }, data: productData });

          if (qtyDelta !== 0) {
            await tx.stockMovement.create({
              data: {
                productId: existing.id,
                type: qtyDelta > 0 ? 'IN' : 'ADJUSTMENT',
                qty: qtyDelta,
                qtyBefore: existing.stockQty,
                qtyAfter: row.stockQty,
                reason: '批次匯入調整',
                operatorId,
              },
            });
          }
          updated.push(row.sku);
        } else {
          const product = await tx.product.create({ data: { sku: row.sku, ...productData } });

          if (row.stockQty > 0) {
            await tx.stockMovement.create({
              data: {
                productId: product.id,
                type: 'IN',
                qty: row.stockQty,
                qtyBefore: 0,
                qtyAfter: row.stockQty,
                reason: '批次匯入初始庫存',
                operatorId,
              },
            });
          }
          created.push(row.sku);
        }
      }

      return { created: created.length, updated: updated.length, total: rows.length };
    });

    res.status(201).json({ success: true, data: results });
  },
);
