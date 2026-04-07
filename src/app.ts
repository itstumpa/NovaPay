import express, { Application, Request, Response } from "express";
import cors from "cors";
import router from "./app/routers";
import passport from "passport";
import "./app/config/passport";
import cookieParser from "cookie-parser";
import compression from "compression";
import helmet from "helmet";

import { requestIdMiddleware } from "./app/middlewares/requestId";
import { logger } from "./utils/logger";
import { rateLimiter } from "./app/middlewares/rateLimiter";
import { env } from "./app/config/env";

import { notFoundHandler } from "./app/middlewares/errorHandler";
import globalErrorHandler from "./app/middlewares/globalErrorHandler";
import notFound from "./app/middlewares/notFound";
import { validateEnv } from "./app/config/env.validation";

const app: Application = express();


app.use(helmet());
app.use(cors({
  origin: env.IS_PRODUCTION ? ['https://novapay.com'] : '*',
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization', 'Idempotency-Key', 'X-Request-Id'],
}));

validateEnv();

app.use(compression());              // gzip
app.use(cookieParser());
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(passport.initialize());

app.use(rateLimiter());

app.use(requestIdMiddleware);

app.use((req, res, next) => {
  const start = Date.now();

  res.on('finish', () => {
    logger.info('HTTP Request', {
      requestId: req.requestId,
      userId: req.userId,
      method: req.method,
      path: req.originalUrl,
      statusCode: res.statusCode,
      durationMs: Date.now() - start,
      ip: req.ip,
    });
  });

  next();
});

app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    service: 'novapay-api',
    version: '1.0.0',
    timestamp: new Date().toISOString(),
    requestId: req.requestId,
  });
});

app.use("/api/v1", router);

app.get("/", (_req: Request, res: Response) => {
  res.send({
    message: "Server Is Running..",
    environment: env.NODE_ENV,
    uptime: process.uptime().toFixed(2) + " second",
    timeStamp: new Date().toISOString(),
  });
});

app.use(notFoundHandler);

app.use(globalErrorHandler);

export default app;