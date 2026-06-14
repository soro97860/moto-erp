import { Router } from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { prisma } from '../lib/prisma';
import { AppError } from '../middleware/errorHandler';
import { authenticate } from '../middleware/auth';
import { loginSchema, registerSchema } from '@moto-erp/shared';

export const authRouter = Router();

// POST /api/v1/auth/login
authRouter.post('/login', async (req, res) => {
  const { username, password } = loginSchema.parse(req.body);

  const user = await prisma.user.findUnique({ where: { username } });
  if (!user || !user.isActive) throw new AppError('帳號或密碼錯誤', 401);

  const ok = await bcrypt.compare(password, user.passwordHash);
  if (!ok) throw new AppError('帳號或密碼錯誤', 401);

  const token = jwt.sign(
    { userId: user.id, role: user.role },
    process.env.JWT_SECRET!,
    { expiresIn: process.env.JWT_EXPIRES_IN || '7d' },
  );

  res.json({
    success: true,
    data: {
      token,
      user: {
        id: user.id,
        username: user.username,
        name: user.name,
        role: user.role,
      },
    },
  });
});

// POST /api/v1/auth/logout
// JWT is stateless — client discards the token. Server-side we just confirm.
authRouter.post('/logout', authenticate, (_req, res) => {
  res.json({ success: true, message: '已登出' });
});

// POST /api/v1/auth/register  (ADMIN only in practice; kept open for initial setup)
authRouter.post('/register', async (req, res) => {
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
    select: { id: true, username: true, name: true, role: true },
  });

  res.status(201).json({ success: true, data: user });
});

// GET /api/v1/auth/me
authRouter.get('/me', authenticate, async (req, res) => {
  const user = await prisma.user.findUniqueOrThrow({
    where: { id: req.user!.userId },
    select: {
      id: true,
      username: true,
      name: true,
      role: true,
      phone: true,
      createdAt: true,
    },
  });
  res.json({ success: true, data: user });
});
