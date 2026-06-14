import { Router } from 'express';
import bcrypt from 'bcrypt';
import { prisma } from '../lib/prisma';
import { authenticate, requireRole } from '../middleware/auth';
import { AppError } from '../middleware/errorHandler';
import { registerSchema } from '@moto-erp/shared';
import { z } from 'zod';

export const userRouter = Router();
userRouter.use(authenticate, requireRole('ADMIN'));

const userSelect = {
  id: true, username: true, name: true, role: true,
  phone: true, isActive: true, createdAt: true,
} as const;

const updateUserSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  phone: z.string().max(30).optional().nullable(),
  role: z.enum(['ADMIN', 'MECHANIC', 'CASHIER']).optional(),
  password: z.string().min(6).max(100).optional(),
});

// ── GET / ─────────────────────────────────────────────────────
userRouter.get('/', async (_req, res) => {
  const users = await prisma.user.findMany({
    select: userSelect,
    orderBy: [{ isActive: 'desc' }, { name: 'asc' }],
  });
  res.json({ success: true, data: users });
});

// ── POST / ────────────────────────────────────────────────────
userRouter.post('/', async (req, res) => {
  const data = registerSchema.parse(req.body);

  const exists = await prisma.user.findUnique({ where: { username: data.username } });
  if (exists) throw new AppError('帳號已被使用', 409);

  const passwordHash = await bcrypt.hash(
    data.password,
    Number(process.env.BCRYPT_SALT_ROUNDS) || 12,
  );

  const user = await prisma.user.create({
    data: {
      username: data.username,
      passwordHash,
      name: data.name,
      role: data.role,
      phone: data.phone,
    },
    select: userSelect,
  });

  res.status(201).json({ success: true, data: user });
});

// ── PUT /:id ──────────────────────────────────────────────────
userRouter.put('/:id', async (req, res) => {
  const { name, phone, role, password } = updateUserSchema.parse(req.body);

  const updateData: Record<string, unknown> = {};
  if (name !== undefined) updateData.name = name;
  if (phone !== undefined) updateData.phone = phone ?? null;
  if (role !== undefined) updateData.role = role;
  if (password) {
    updateData.passwordHash = await bcrypt.hash(
      password,
      Number(process.env.BCRYPT_SALT_ROUNDS) || 12,
    );
  }

  const user = await prisma.user.update({
    where: { id: req.params.id },
    data: updateData,
    select: userSelect,
  });

  res.json({ success: true, data: user });
});

// ── PATCH /:id/toggle ─────────────────────────────────────────
userRouter.patch('/:id/toggle', async (req, res) => {
  const user = await prisma.user.findUniqueOrThrow({ where: { id: req.params.id } });
  if (user.id === req.user!.userId) throw new AppError('無法停用自己的帳號', 400);

  const updated = await prisma.user.update({
    where: { id: req.params.id },
    data: { isActive: !user.isActive },
    select: userSelect,
  });
  res.json({ success: true, data: updated });
});
