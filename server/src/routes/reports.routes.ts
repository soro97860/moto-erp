import { Router } from 'express';
import dayjs from 'dayjs';
import { prisma } from '../lib/prisma';
import { authenticate, requireRole } from '../middleware/auth';
import { reportDailySchema, reportPeriodSchema } from '@moto-erp/shared';
import { AppError } from '../middleware/errorHandler';
import { toCSV } from '../utils/csv';

export const reportsRouter = Router();
reportsRouter.use(authenticate, requireRole('ADMIN', 'CASHIER'));

// ── Helpers ───────────────────────────────────────────────────

function parseDateRange(from: string, to: string) {
  const start = dayjs(from);
  const end = dayjs(to);
  if (!start.isValid() || !end.isValid()) throw new AppError('日期格式無效（請用 YYYY-MM-DD）', 400);
  if (end.isBefore(start)) throw new AppError('結束日期不可早於開始日期', 400);
  return {
    gte: start.startOf('day').toDate(),
    lte: end.endOf('day').toDate(),
  };
}

function buildSummary(
  orders: Array<{
    total: unknown;
    laborFee: unknown;
    subtotal: unknown;
    discount: unknown;
    items: Array<{ qty: number; unitPrice: unknown; costPrice?: unknown }>;
  }>,
) {
  const revenue = orders.reduce((s, o) => s + Number(o.total), 0);
  const laborTotal = orders.reduce((s, o) => s + Number(o.laborFee), 0);
  const discountTotal = orders.reduce((s, o) => s + Number(o.discount), 0);
  const partsRevenue = orders.reduce((s, o) => s + Number(o.subtotal), 0);
  const count = orders.length;
  return { count, revenue, laborTotal, partsRevenue, discountTotal };
}

// ── GET /daily?date=YYYY-MM-DD ────────────────────────────────
reportsRouter.get('/daily', async (req, res) => {
  const { date } = reportDailySchema.parse(req.query);
  const d = dayjs(date);
  if (!d.isValid()) throw new AppError('日期格式無效', 400);

  const where = {
    createdAt: { gte: d.startOf('day').toDate(), lte: d.endOf('day').toDate() },
    status: { not: 'CANCELLED' as const },
  };

  const orders = await prisma.order.findMany({
    where,
    include: {
      customer: { select: { name: true, licensePlate: true } },
      operator: { select: { name: true } },
      items: {
        include: {
          product: { select: { name: true, costPrice: true } },
        },
      },
    },
    orderBy: { createdAt: 'asc' },
  });

  const summary = buildSummary(
    orders.map((o) => ({
      total: o.total,
      laborFee: o.laborFee,
      subtotal: o.subtotal,
      discount: o.discount,
      items: o.items.map((i) => ({
        qty: i.qty,
        unitPrice: i.unitPrice,
        costPrice: i.product.costPrice,
      })),
    })),
  );

  // Estimated gross profit (revenue - parts cost - labour cost not tracked separately)
  const partsCost = orders.reduce((s, o) =>
    s + o.items.reduce((is, i) => is + Number(i.product.costPrice) * i.qty, 0), 0,
  );

  res.json({
    success: true,
    data: {
      date: d.format('YYYY-MM-DD'),
      summary: { ...summary, partsCost, grossProfit: summary.revenue - partsCost },
      orders,
    },
  });
});

// ── GET /period?from=YYYY-MM-DD&to=YYYY-MM-DD ─────────────────
reportsRouter.get('/period', async (req, res) => {
  const { from, to } = reportPeriodSchema.parse(req.query);
  const dateRange = parseDateRange(from, to);

  const where = {
    createdAt: dateRange,
    status: { not: 'CANCELLED' as const },
  };

  const [orders, dailyAgg] = await Promise.all([
    prisma.order.findMany({
      where,
      include: {
        customer: { select: { name: true, licensePlate: true } },
        operator: { select: { name: true } },
        items: {
          include: { product: { select: { name: true, costPrice: true } } },
        },
      },
      orderBy: { createdAt: 'asc' },
    }),
    // Daily breakdown aggregation
    prisma.$queryRaw<Array<{ day: string; count: bigint; revenue: number }>>`
      SELECT
        DATE(created_at AT TIME ZONE 'Asia/Taipei') AS day,
        COUNT(*)::bigint                           AS count,
        SUM(total)::float                          AS revenue
      FROM orders
      WHERE created_at >= ${dateRange.gte}
        AND created_at <= ${dateRange.lte}
        AND status != 'CANCELLED'
      GROUP BY 1
      ORDER BY 1
    `,
  ]);

  const summary = buildSummary(
    orders.map((o) => ({
      total: o.total,
      laborFee: o.laborFee,
      subtotal: o.subtotal,
      discount: o.discount,
      items: o.items.map((i) => ({
        qty: i.qty,
        unitPrice: i.unitPrice,
        costPrice: i.product.costPrice,
      })),
    })),
  );

  const partsCost = orders.reduce((s, o) =>
    s + o.items.reduce((is, i) => is + Number(i.product.costPrice) * i.qty, 0), 0,
  );

  res.json({
    success: true,
    data: {
      from,
      to,
      summary: { ...summary, partsCost, grossProfit: summary.revenue - partsCost },
      dailyBreakdown: dailyAgg.map((row) => ({
        day: row.day,
        count: Number(row.count),
        revenue: Number(row.revenue),
      })),
      orders,
    },
  });
});

// ── GET /inventory ────────────────────────────────────────────
reportsRouter.get('/inventory', async (req, res) => {
  const products = await prisma.product.findMany({
    where: { isActive: true },
    include: {
      brand: { select: { name: true } },
      category: { select: { name: true } },
      storageLocation: true,
    },
    orderBy: [{ category: { name: 'asc' } }, { name: 'asc' }],
  });

  const totalItems = products.length;
  const totalStockValue = products.reduce(
    (s, p) => s + Number(p.costPrice) * p.stockQty,
    0,
  );
  const totalSellValue = products.reduce(
    (s, p) => s + Number(p.sellPrice) * p.stockQty,
    0,
  );
  const lowStockItems = products.filter((p) => p.stockQty <= p.minStockQty).length;
  const zeroStockItems = products.filter((p) => p.stockQty === 0).length;

  res.json({
    success: true,
    data: {
      summary: { totalItems, totalStockValue, totalSellValue, lowStockItems, zeroStockItems },
      products,
    },
  });
});

// ── GET /export/orders?from=&to= ──────────────────────────────
// Returns a CSV file download of all completed orders in the date range
reportsRouter.get('/export/orders', async (req, res) => {
  const { from, to } = reportPeriodSchema.parse(req.query);
  const dateRange = parseDateRange(from, to);

  const orders = await prisma.order.findMany({
    where: {
      createdAt: dateRange,
      status: { not: 'CANCELLED' },
    },
    include: {
      customer: { select: { name: true, phone: true, licensePlate: true } },
      operator: { select: { name: true } },
      items: {
        include: { product: { select: { sku: true, name: true, unit: true } } },
      },
    },
    orderBy: { createdAt: 'asc' },
  });

  // Flatten: one row per order item
  const headers = [
    '工單號', '建立日期', '完成日期', '狀態',
    '車主姓名', '電話', '車牌',
    '操作員',
    'SKU', '品名', '單位', '數量', '單價', '折扣', '小計',
    '工資', '工單折扣', '工單總計',
  ];

  const rows: (string | number | null)[][] = [];

  for (const o of orders) {
    if (o.items.length === 0) {
      rows.push([
        o.orderNo,
        dayjs(o.createdAt).format('YYYY-MM-DD HH:mm'),
        o.completedAt ? dayjs(o.completedAt).format('YYYY-MM-DD HH:mm') : '',
        o.status,
        o.customer.name, o.customer.phone, o.customer.licensePlate,
        o.operator.name,
        '', '', '', '', '', '', '',
        Number(o.laborFee), Number(o.discount), Number(o.total),
      ]);
    } else {
      o.items.forEach((item, idx) => {
        rows.push([
          o.orderNo,
          dayjs(o.createdAt).format('YYYY-MM-DD HH:mm'),
          o.completedAt ? dayjs(o.completedAt).format('YYYY-MM-DD HH:mm') : '',
          o.status,
          o.customer.name, o.customer.phone, o.customer.licensePlate,
          o.operator.name,
          item.product.sku,
          item.product.name,
          item.product.unit,
          item.qty,
          Number(item.unitPrice),
          Number(item.discount),
          Number(item.subtotal),
          // Summary columns only on first item row
          idx === 0 ? Number(o.laborFee) : '',
          idx === 0 ? Number(o.discount) : '',
          idx === 0 ? Number(o.total) : '',
        ]);
      });
    }
  }

  const csv = toCSV(headers, rows);

  const filename = `orders_${from}_${to}.csv`;
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  // BOM for Excel to recognize UTF-8
  res.send('﻿' + csv);
});
