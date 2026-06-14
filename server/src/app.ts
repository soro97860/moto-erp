import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';

import { authRouter } from './routes/auth.routes';
import { userRouter } from './routes/user.routes';
import { brandRouter } from './routes/brand.routes';
import { categoryRouter } from './routes/category.routes';
import { productRouter } from './routes/product.routes';
import { customerRouter } from './routes/customer.routes';
import { serviceRecordRouter } from './routes/serviceRecord.routes';
import { orderRouter } from './routes/order.routes';
import { warehouseRouter } from './routes/warehouse.routes';
import { reportsRouter } from './routes/reports.routes';
import { storageLocationRouter } from './routes/storageLocation.routes';
import { settingsRouter } from './routes/settings.routes';
import { errorHandler } from './middleware/errorHandler';
import { notFound } from './middleware/notFound';

export const app = express();

// ── Middleware ────────────────────────────────────────────────
app.use(helmet());
app.use(
  cors({
    origin: process.env.CLIENT_ORIGIN || '*',
    credentials: true,
    exposedHeaders: ['Content-Disposition'], // needed for CSV download
  }),
);
// JSON parser for application/json requests
app.use(express.json({ limit: '5mb' }));
// URL-encoded forms (optional but harmless)
app.use(express.urlencoded({ extended: true }));
app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'));

// ── Routes ────────────────────────────────────────────────────
const v1 = '/api/v1';

// Auth
app.use(`${v1}/auth`, authRouter);
// Users / staff
app.use(`${v1}/users`, userRouter);
// Master data
app.use(`${v1}/brands`, brandRouter);
app.use(`${v1}/categories`, categoryRouter);
// Products (includes /import and /barcode/:code)
app.use(`${v1}/products`, productRouter);
// Customers + history
app.use(`${v1}/customers`, customerRouter);
// Service records (standalone)
app.use(`${v1}/service-records`, serviceRecordRouter);
// Orders (creates ServiceRecord inline when body.service is present)
app.use(`${v1}/orders`, orderRouter);
// Warehouse: stock-in, movements, locations, low-stock
app.use(`${v1}/warehouse`, warehouseRouter);
// Reports: daily, period, inventory, CSV export
app.use(`${v1}/reports`, reportsRouter);
// Storage locations (admin CRUD; also exposed via /warehouse/locations)
app.use(`${v1}/storage-locations`, storageLocationRouter);
// System settings (key-value, admin write)
app.use(`${v1}/settings`, settingsRouter);

// Health check
app.get(`${v1}/health`, (_req, res) =>
  res.json({ status: 'ok', timestamp: new Date().toISOString() }),
);

// ── Error handling (must be last) ─────────────────────────────
app.use(notFound);
app.use(errorHandler);
