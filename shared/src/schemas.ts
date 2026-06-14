import { z } from 'zod';

// ── Auth ─────────────────────────────────────────────────────
export const loginSchema = z.object({
  username: z.string().min(1),
  password: z.string().min(6),
});

export const registerSchema = z.object({
  username: z.string().min(3).max(50),
  password: z.string().min(6).max(100),
  name: z.string().min(1).max(100),
  role: z.enum(['ADMIN', 'MECHANIC', 'CASHIER']).default('MECHANIC'),
  phone: z.string().optional(),
});

// ── Brand ────────────────────────────────────────────────────
export const brandSchema = z.object({
  name: z.string().min(1).max(100),
  note: z.string().optional(),
});

// ── Category ─────────────────────────────────────────────────
export const categorySchema = z.object({
  name: z.string().min(1).max(100),
  parentId: z.string().uuid().optional().nullable(),
});

// ── StorageLocation ──────────────────────────────────────────
export const storageLocationSchema = z.object({
  floor: z.string().min(1).max(20),
  cabinet: z.string().min(1).max(20),
  shelf: z.string().min(1).max(20),
  note: z.string().optional(),
});

// ── Product ──────────────────────────────────────────────────
export const productSchema = z.object({
  sku: z.string().min(1).max(100),
  barcode: z.string().max(100).optional().nullable(),
  name: z.string().min(1).max(200),
  brandId: z.string().uuid().optional().nullable(),
  categoryId: z.string().uuid().optional().nullable(),
  storageLocationId: z.string().uuid().optional().nullable(),
  sellPrice: z.number().nonnegative(),
  costPrice: z.number().nonnegative(),
  stockQty: z.number().int().default(0),
  minStockQty: z.number().int().default(0),
  unit: z.string().default('個'),
  note: z.string().optional(),
});

// One row in batch import; brandName/categoryName are resolved on the server
export const importProductRowSchema = z.object({
  sku: z.string().min(1).max(100),
  name: z.string().min(1).max(200),
  barcode: z.string().max(100).optional().nullable(),
  brandName: z.string().max(100).optional(),
  categoryName: z.string().max(100).optional(),
  sellPrice: z.coerce.number().nonnegative(),
  costPrice: z.coerce.number().nonnegative(),
  stockQty: z.coerce.number().int().default(0),
  minStockQty: z.coerce.number().int().default(0),
  unit: z.string().default('個'),
  note: z.string().optional(),
});

export const importProductsSchema = z.object({
  items: z.array(importProductRowSchema).min(1).max(500),
});

// ── Customer ─────────────────────────────────────────────────
export const customerSchema = z.object({
  name: z.string().min(1).max(100),
  phone: z.string().min(1).max(30),
  licensePlate: z.string().min(1).max(20),
  vehicleColor: z.string().max(50).optional(),
  vehicleModel: z.string().max(100).optional(),
  note: z.string().optional(),
});

// ── ServiceRecord ────────────────────────────────────────────
export const serviceRecordSchema = z.object({
  customerId: z.string().uuid(),
  licensePlate: z.string().min(1).max(20),
  serviceDate: z.string().datetime(),
  mileage: z.number().int().optional().nullable(),
  description: z.string().min(1),
  diagnosis: z.string().optional(),
  technicianId: z.string().uuid().optional().nullable(),
  note: z.string().optional(),
});

// ── Order ────────────────────────────────────────────────────
export const orderItemSchema = z.object({
  productId: z.string().uuid(),
  qty: z.number().int().positive(),
  unitPrice: z.number().nonnegative(),
  discount: z.number().nonnegative().default(0),
});

// Optional inline service record created together with the order
const inlineServiceSchema = z.object({
  licensePlate: z.string().min(1).max(20),
  serviceDate: z.string().datetime().optional(),
  mileage: z.number().int().optional().nullable(),
  description: z.string().min(1),
  diagnosis: z.string().optional(),
});

export const createOrderSchema = z.object({
  customerId: z.string().uuid().optional().nullable(),
  // Pass an existing serviceRecordId OR let the server create one via `service`
  serviceRecordId: z.string().uuid().optional().nullable(),
  service: inlineServiceSchema.optional(),
  laborFee: z.number().nonnegative().default(0),
  discount: z.number().nonnegative().default(0),
  note: z.string().optional(),
  items: z.array(orderItemSchema).min(1),
});

export const completeOrderSchema = z.object({
  paymentMethod: z.enum(['CASH', 'CARD', 'TRANSFER']).default('CASH'),
  amountPaid: z.number().nonnegative().optional(),
  note: z.string().optional(),
});

export const orderFilterSchema = z.object({
  from: z.string().optional(),
  to: z.string().optional(),
  status: z.enum(['PENDING', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED']).optional(),
  customerId: z.string().uuid().optional(),
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().positive().max(100).default(20),
});

// ── Warehouse ────────────────────────────────────────────────
export const stockInSchema = z.object({
  productId: z.string().uuid(),
  qty: z.number().int().positive(),
  storageLocationId: z.string().uuid().optional().nullable(),
  reason: z.string().optional(),
});

// ── StockMovement (manual / general) ─────────────────────────
export const stockMovementSchema = z.object({
  productId: z.string().uuid(),
  type: z.enum(['IN', 'OUT', 'ADJUSTMENT']),
  qty: z.number().int(),
  reason: z.string().optional(),
});

// ── Reports ──────────────────────────────────────────────────
export const reportPeriodSchema = z.object({
  from: z.string().min(1, 'from is required'),
  to: z.string().min(1, 'to is required'),
});

export const reportDailySchema = z.object({
  date: z.string().min(1, 'date is required'),
});

// ── Inferred types ────────────────────────────────────────────
export type LoginInput = z.infer<typeof loginSchema>;
export type RegisterInput = z.infer<typeof registerSchema>;
export type BrandInput = z.infer<typeof brandSchema>;
export type CategoryInput = z.infer<typeof categorySchema>;
export type StorageLocationInput = z.infer<typeof storageLocationSchema>;
export type ProductInput = z.infer<typeof productSchema>;
export type ImportProductRow = z.infer<typeof importProductRowSchema>;
export type CustomerInput = z.infer<typeof customerSchema>;
export type ServiceRecordInput = z.infer<typeof serviceRecordSchema>;
export type CreateOrderInput = z.infer<typeof createOrderSchema>;
export type OrderItemInput = z.infer<typeof orderItemSchema>;
export type CompleteOrderInput = z.infer<typeof completeOrderSchema>;
export type OrderFilterInput = z.infer<typeof orderFilterSchema>;
export type StockInInput = z.infer<typeof stockInSchema>;
export type StockMovementInput = z.infer<typeof stockMovementSchema>;
