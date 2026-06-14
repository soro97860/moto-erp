import { Router } from 'express';
import dayjs from 'dayjs';
import { prisma } from '../lib/prisma';
import { authenticate, requireRole } from '../middleware/auth';
import { createOrderSchema, orderFilterSchema, completeOrderSchema } from '@moto-erp/shared';
import { AppError } from '../middleware/errorHandler';
import { generateOrderNo } from '../utils/orderNo';
import { paginated } from '../utils/pagination';

export const orderRouter = Router();
orderRouter.use(authenticate);

const orderInclude = {
  customer: true,
  operator: { select: { id: true, name: true } },
  serviceRecord: true,
  items: {
    include: {
      product: { select: { id: true, name: true, sku: true, unit: true } },
    },
  },
};

// ── GET / ─────────────────────────────────────────────────────
// ?from=2024-01-01&to=2024-12-31&status=COMPLETED&customerId=&page=&pageSize=
orderRouter.get('/', async (req, res) => {
  const filter = orderFilterSchema.parse(req.query);
  const skip = (filter.page - 1) * filter.pageSize;

  const where: Record<string, unknown> = {};

  if (filter.from || filter.to) {
    const createdAt: Record<string, Date> = {};
    if (filter.from) createdAt.gte = dayjs(filter.from).startOf('day').toDate();
    if (filter.to) createdAt.lte = dayjs(filter.to).endOf('day').toDate();
    where.createdAt = createdAt;
  }
  if (filter.status) where.status = filter.status;
  if (filter.customerId) where.customerId = filter.customerId;

  const [items, total] = await Promise.all([
    prisma.order.findMany({
      where,
      include: orderInclude,
      orderBy: { createdAt: 'desc' },
      skip,
      take: filter.pageSize,
    }),
    prisma.order.count({ where }),
  ]);

  res.json({ success: true, data: paginated(items, total, filter.page, filter.pageSize) });
});

// ── GET /:id ──────────────────────────────────────────────────
orderRouter.get('/:id', async (req, res) => {
  const order = await prisma.order.findUniqueOrThrow({
    where: { id: req.params.id },
    include: orderInclude,
  });
  res.json({ success: true, data: order });
});

// ── GET /:id/receipt ──────────────────────────────────────────
orderRouter.get('/:id/receipt', async (req, res) => {
  const order = await prisma.order.findUniqueOrThrow({
    where: { id: req.params.id },
    include: {
      customer: true,
      operator: { select: { id: true, name: true } },
      serviceRecord: true,
      items: {
        include: {
          product: { select: { id: true, sku: true, name: true, unit: true } },
        },
      },
    },
  });

  const receipt = {
    id: order.id,
    orderNo: order.orderNo,
    issuedAt: dayjs(order.completedAt ?? order.createdAt).format('YYYY-MM-DD HH:mm'),
    status: order.status,
    customer: order.customer
      ? {
          name: order.customer.name,
          phone: order.customer.phone,
          licensePlate: order.customer.licensePlate,
          vehicleModel: order.customer.vehicleModel,
          vehicleColor: order.customer.vehicleColor,
        }
      : { name: '一般購買', phone: '—', licensePlate: '—', vehicleModel: null, vehicleColor: null },
    operator: order.operator.name,
    items: order.items.map((item) => ({
      sku: item.product.sku,
      name: item.product.name,
      unit: item.product.unit,
      qty: item.qty,
      unitPrice: Number(item.unitPrice),
      discount: Number(item.discount),
      subtotal: Number(item.subtotal),
    })),
    laborFee: Number(order.laborFee),
    subtotal: Number(order.subtotal),
    discount: Number(order.discount),
    total: Number(order.total),
    note: order.note,
    serviceDescription: order.serviceRecord?.description ?? null,
  };

  res.json({ success: true, data: receipt });
});

// ── POST / ────────────────────────────────────────────────────
// Creates Order + OrderItems + optional ServiceRecord, deducts stock, writes StockMovements
orderRouter.post('/', async (req, res) => {
  const body = createOrderSchema.parse(req.body);
  const operatorId = req.user!.userId;

  // Validate stock availability
  const productIds = body.items.map((i) => i.productId);
  const products = await prisma.product.findMany({
    where: { id: { in: productIds }, isActive: true },
  });

  for (const item of body.items) {
    const p = products.find((x) => x.id === item.productId);
    if (!p) throw new AppError(`商品 ${item.productId} 不存在`, 404);
    if (p.stockQty < item.qty)
      throw new AppError(`「${p.name}」庫存不足（現有 ${p.stockQty} ${p.unit}）`, 400);
  }

  const subtotal = body.items.reduce(
    (sum, i) => sum + i.unitPrice * i.qty - (i.discount ?? 0),
    0,
  );
  const total = subtotal + body.laborFee - body.discount;

  const order = await prisma.$transaction(async (tx) => {
    // 1. Optionally create ServiceRecord inline
    let serviceRecordId = body.serviceRecordId ?? null;

    if (body.service && !serviceRecordId && body.customerId) {
      const sr = await tx.serviceRecord.create({
        data: {
          customerId: body.customerId,
          licensePlate: body.service.licensePlate,
          serviceDate: body.service.serviceDate
            ? new Date(body.service.serviceDate)
            : new Date(),
          mileage: body.service.mileage ?? null,
          description: body.service.description,
          diagnosis: body.service.diagnosis ?? null,
          technicianId: operatorId,
        },
      });
      serviceRecordId = sr.id;
    }

    // 2. Create Order + OrderItems
    const created = await tx.order.create({
      data: {
        orderNo: generateOrderNo(),
        customerId: body.customerId,
        serviceRecordId,
        operatorId,
        laborFee: body.laborFee,
        discount: body.discount,
        subtotal,
        total,
        note: body.note,
        items: {
          create: body.items.map((i) => ({
            productId: i.productId,
            qty: i.qty,
            unitPrice: i.unitPrice,
            discount: i.discount ?? 0,
            subtotal: i.unitPrice * i.qty - (i.discount ?? 0),
          })),
        },
      },
      include: orderInclude,
    });

    // 3. Deduct stock + write StockMovements (type OUT, reason = 工單號)
    for (const item of body.items) {
      const p = products.find((x) => x.id === item.productId)!;
      const qtyAfter = p.stockQty - item.qty;

      await tx.product.update({
        where: { id: item.productId },
        data: { stockQty: qtyAfter },
      });

      await tx.stockMovement.create({
        data: {
          productId: item.productId,
          type: 'OUT',
          qty: -item.qty,
          qtyBefore: p.stockQty,
          qtyAfter,
          reason: `工單 ${created.orderNo}`,
          orderId: created.id,
          operatorId,
        },
      });

      // Mutate in-memory for subsequent iterations in the same order
      p.stockQty = qtyAfter;
    }

    return created;
  });

  res.status(201).json({ success: true, data: order });
});

// ── PUT /:id/complete ─────────────────────────────────────────
orderRouter.put('/:id/complete', requireRole('ADMIN', 'CASHIER'), async (req, res) => {
  const { paymentMethod, note } = completeOrderSchema.parse(req.body);

  const existing = await prisma.order.findUniqueOrThrow({ where: { id: req.params.id } });
  if (existing.status === 'CANCELLED') throw new AppError('已取消的工單不可結帳', 400);
  if (existing.status === 'COMPLETED') throw new AppError('工單已結帳', 400);

  const order = await prisma.order.update({
    where: { id: req.params.id },
    data: {
      status: 'COMPLETED',
      completedAt: new Date(),
      note: note ? `${existing.note ? existing.note + '\n' : ''}結帳備註：${note}` : existing.note,
      // paymentMethod could be stored in a Payment table; stored in note for now
    },
    include: orderInclude,
  });

  res.json({ success: true, data: { order, paymentMethod } });
});

// ── PATCH /:id/status ─────────────────────────────────────────
orderRouter.patch('/:id/status', requireRole('ADMIN', 'CASHIER'), async (req, res) => {
  const { status } = req.body as { status: string };
  const allowed = ['PENDING', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED'];
  if (!allowed.includes(status)) throw new AppError('Invalid status', 400);

  const order = await prisma.order.update({
    where: { id: req.params.id },
    data: {
      status: status as 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED',
      completedAt: status === 'COMPLETED' ? new Date() : undefined,
    },
    include: orderInclude,
  });
  res.json({ success: true, data: order });
});
