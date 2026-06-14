import { Router } from 'express';
import { prisma } from '../lib/prisma';
import { authenticate } from '../middleware/auth';
import { customerSchema } from '@moto-erp/shared';
import { AppError } from '../middleware/errorHandler';
import { parsePagination, paginated } from '../utils/pagination';

export const customerRouter = Router();
customerRouter.use(authenticate);

// ── GET / ─────────────────────────────────────────────────────
// ?search=<name|phone|plate>&page=&pageSize=
customerRouter.get('/', async (req, res) => {
  const { page, pageSize, skip, take } = parsePagination(req.query as Record<string, unknown>);
  const search = req.query.search as string | undefined;

  const where = search
    ? {
        isActive: true,
        OR: [
          { name: { contains: search, mode: 'insensitive' as const } },
          { phone: { contains: search } },
          { licensePlate: { contains: search, mode: 'insensitive' as const } },
        ],
      }
    : { isActive: true };

  const [items, total] = await Promise.all([
    prisma.customer.findMany({ where, orderBy: { name: 'asc' }, skip, take }),
    prisma.customer.count({ where }),
  ]);

  res.json({ success: true, data: paginated(items, total, page, pageSize) });
});

// ── GET /plate/:plateNumber ───────────────────────────────────
customerRouter.get('/plate/:plateNumber', async (req, res) => {
  const plate = decodeURIComponent(req.params.plateNumber).toUpperCase();

  const customers = await prisma.customer.findMany({
    where: { licensePlate: { equals: plate, mode: 'insensitive' }, isActive: true },
    include: {
      serviceRecords: {
        orderBy: { serviceDate: 'desc' },
        take: 5,
        include: { technician: { select: { id: true, name: true } } },
      },
    },
  });

  if (!customers.length) throw new AppError('找不到此車牌的車主', 404);
  res.json({ success: true, data: customers });
});

// ── GET /:id ──────────────────────────────────────────────────
customerRouter.get('/:id', async (req, res) => {
  const customer = await prisma.customer.findFirstOrThrow({
    where: { id: req.params.id, isActive: true },
    include: {
      serviceRecords: { orderBy: { serviceDate: 'desc' }, take: 5 },
      orders: { orderBy: { createdAt: 'desc' }, take: 5 },
    },
  });
  res.json({ success: true, data: customer });
});

// ── GET /:id/history ──────────────────────────────────────────
// Returns paginated full repair + order history sorted newest first
customerRouter.get('/:id/history', async (req, res) => {
  const { page, pageSize, skip, take } = parsePagination(req.query as Record<string, unknown>);

  const customer = await prisma.customer.findFirst({
    where: { id: req.params.id, isActive: true },
  });
  if (!customer) throw new AppError('客戶不存在', 404);

  const [serviceRecords, srTotal] = await Promise.all([
    prisma.serviceRecord.findMany({
      where: { customerId: req.params.id },
      include: {
        technician: { select: { id: true, name: true } },
        orders: {
          include: {
            items: {
              include: { product: { select: { id: true, name: true, sku: true, unit: true } } },
            },
            operator: { select: { id: true, name: true } },
          },
        },
      },
      orderBy: { serviceDate: 'desc' },
      skip,
      take,
    }),
    prisma.serviceRecord.count({ where: { customerId: req.params.id } }),
  ]);

  res.json({
    success: true,
    data: {
      customer,
      ...paginated(serviceRecords, srTotal, page, pageSize),
    },
  });
});

// ── POST / ────────────────────────────────────────────────────
customerRouter.post('/', async (req, res) => {
  const data = customerSchema.parse(req.body);
  const customer = await prisma.customer.create({ data });
  res.status(201).json({ success: true, data: customer });
});

// ── PUT /:id ──────────────────────────────────────────────────
customerRouter.put('/:id', async (req, res) => {
  const data = customerSchema.parse(req.body);
  const customer = await prisma.customer.update({ where: { id: req.params.id }, data });
  res.json({ success: true, data: customer });
});
