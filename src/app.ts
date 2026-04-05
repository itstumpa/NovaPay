import express, { Application, Request, Response } from "express";
import cors from "cors";
import router from "./app/routers";
import passport from "passport";
import "./app/config/passport";
import { config } from "./app/config/index";
import notFound from "./app/middlewares/notFound";
import globalErrorHandler from "./app/middlewares/globalErrorHandler";
import cookieParser from "cookie-parser";
import compression from "compression";
import helmet from "helmet";
import { requestIdMiddleware } from "./app/middlewares/requestId";
import { logger } from "./utils/logger";
import { notFoundHandler } from "./app/middlewares/errorHandler";
import { rateLimiter } from "./app/middlewares/rateLimiter";
import { env } from "./app/config/env";


const app: Application = express();

// ─── Security Middleware ──────────────────────────────────────────────
app.use(helmet());
app.use(cors({
  origin: env.IS_PRODUCTION ? ['https://novapay.com'] : '*',
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization', 'Idempotency-Key', 'X-Request-Id'],
}));

// ─── Body Parsing ─────────────────────────────────────────────────────
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(passport.initialize());

// ─── Request Tracing ──────────────────────────────────────────────────
app.use(requestIdMiddleware);

// ─── Request Logging ──────────────────────────────────────────────────
app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    logger.info('HTTP Request', {
      requestId: req.requestId,
      userId: req.userId,
      method: req.method,
      path: req.path,
      statusCode: res.statusCode,
      durationMs: Date.now() - start,
      ip: req.ip,
    });
  });
  next();
});


// ─── Health Check ─────────────────────────────────────────────────────
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    service: 'novapay-api',
    version: '1.0.0',
    timestamp: new Date().toISOString(),
    requestId: req.requestId,
  });
  
});

// ─── Error Handling ───────────────────────────────────────────────────
app.use(notFoundHandler);
app.use(globalErrorHandler);


// Gzip compression
app.use(compression());

// Redis Rate limit 
app.use(rateLimiter());

// MAIN ROUTE
app.use("/api/v1", router);

app.get("/", (_req: Request, res: Response) => {
  res.send({
    message: "Server Is Running..",
    environment: env.NODE_ENV,
    uptime: process.uptime().toFixed(2) + " second",
    timeStamp: new Date().toISOString(),
  });
});

app.use(globalErrorHandler);
app.use(notFound);

export default app;