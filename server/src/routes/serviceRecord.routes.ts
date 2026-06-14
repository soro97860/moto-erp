import { Router } from 'express';
import { prisma } from '../lib/prisma';
import { authenticate } from '../middleware/auth';
import { serviceRecordSchema } from '@moto-erp/shared';
import { parsePagination, paginated } from '../utils/pagination';

export const serviceRecordRouter = Router();
serviceRecordRouter.use(authenticate);

serviceRecordRouter.get('/', async (req, res) => {
  const { page, pageSize, skip, take } = parsePagination(req.query as Record<string, unknown>);
  const search = req.query.search as string | undefined;

  const where = search
    ? {
        OR: [
          { licensePlate: { contains: search, mode: 'insensitive' as const } },
          { description: { contains: search, mode: 'insensitive' as const } },
          { customer: { name: { contains: search, mode: 'insensitive' as const } } },
        ],
      }
    : undefined;

  const [items, total] = await Promise.all([
    prisma.serviceRecord.findMany({
      where,
      include: { customer: true, technician: { select: { id: true, name: true } } },
      orderBy: { serviceDate: 'desc' },
      skip,
      take,
    }),
    prisma.serviceRecord.count({ where }),
  ]);

  res.json({ success: true, data: paginated(items, total, page, pageSize) });
});

serviceRecordRouter.get('/:id', async (req, res) => {
  const record = await prisma.serviceRecord.findUniqueOrThrow({
    where: { id: req.params.id },
    include: {
      customer: true,
      technician: { select: { id: true, name: true } },
      orders: { include: { items: { include: { product: true } } } },
    },
  });
  res.json({ success: true, data: record });
});

serviceRecordRouter.post('/', async (req, res) => {
  const data = serviceRecordSchema.parse(req.body);
  const record = await prisma.serviceRecord.create({ data });
  res.status(201).json({ success: true, data: record });
});

serviceRecordRouter.put('/:id', async (req, res) => {
  const data = serviceRecordSchema.parse(req.body);
  const record = await prisma.serviceRecord.update({ where: { id: req.params.id }, data });
  res.json({ success: true, data: record });
});
