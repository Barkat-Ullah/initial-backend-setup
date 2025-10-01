import cors from 'cors';
import express, { Application, NextFunction, Request, Response } from 'express';
import httpStatus from 'http-status';
import globalErrorHandler from './app/middlewares/globalErrorHandler';
import router from './app/routes';
import auth from './app/middlewares/auth';
import { upload } from './app/utils/fileUploader';
import {
  apiLimiter,
  imageUpload,
  notFound,
  rootHandler,
  serverHealth,
  setupMiddlewares,
} from './shared';
import catchAsync from './app/utils/catchAsync';
import { prisma } from './app/utils/prisma';
// import { StripeWebHook } from './app/utils/StripeUtils';

const app: Application = express();

setupMiddlewares(app);

app.use('/api/v1', apiLimiter, router);

// Stripe webhook (if needed, before error handler)
app.post(
  '/api/v1/stripe/webhook',
  express.raw({ type: 'application/json' }),
  // StripeWebHook,
);

// Upload route (after main routes, before error handler)
app.post(
  '/api/v1/upload-image',
  auth('ANY'),
  upload.single('image'),
  imageUpload,
);

// Root route (Better: JSON response with icon)

app.get('/', rootHandler);
app.get('/health', serverHealth);

// 404 handler (before global error)
app.use(notFound);

// Global error handler (last)
app.use(globalErrorHandler);

export default app;
