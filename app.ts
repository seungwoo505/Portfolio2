import type { Request, Response } from "express";

const express = require("express");
const publicRoutes = require("./routes/public");
const adminRoutes = require("./routes/admin");
const monitoringRoutes = require("./routes/monitoring");
const { buildHealthResponse } = require("./utils/health-response");
const {
    configureCoreMiddleware,
    configureSecurityMiddleware,
    mountStaticAssets
} = require("./config/security");
const { mountSwaggerDocs } = require("./config/swagger");
const {
    generalLimiter,
    publicReadLimiter,
    adminLimiter,
    aiLimiter,
    monitoringLimiter,
    loginLimiter,
    contactLimiter
} = require("./middleware/rate-limiters");
const {
    REQUEST_TIMEOUT,
    AI_REQUEST_TIMEOUT,
    requestTimeoutMiddleware
} = require("./middleware/request-timeout");
const { requestLoggingMiddleware } = require("./middleware/request-logging");
const { notFoundHandler, errorHandler } = require("./middleware/error-handlers");
const { apiResponseNormalizer } = require("./utils/api-response");

const app = express();
const port = process.env.PORT || 3333;

configureSecurityMiddleware(app);
app.use(generalLimiter);
configureCoreMiddleware(app);
app.use(requestTimeoutMiddleware);
mountStaticAssets(app);
mountSwaggerDocs(app, { port });
app.use(requestLoggingMiddleware);
app.use(apiResponseNormalizer);

/**
 * @swagger
 * /health:
 *   get:
 *     summary: 서비스 생존 상태 확인
 *     description: DB 및 외부 서비스 연결 상태를 검사하지 않는 생존 확인 API입니다.
 *     tags: ['Health']
 *     security: []
 *     responses:
 *       200:
 *         description: 서버가 요청을 처리할 수 있음
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               required: [status, timestamp, uptime]
 *               properties:
 *                 status: { type: string, enum: [healthy] }
 *                 timestamp: { type: string, format: date-time }
 *                 uptime: { type: string, example: '123s' }
 */
app.get("/health", (_req: Request, res: Response) => {
    res.json(buildHealthResponse());
});

app.use("/public/contact", contactLimiter);
app.use("/public", publicReadLimiter, publicRoutes);
app.use("/admin/login", loginLimiter);
app.use("/admin/ai", aiLimiter);
app.use("/admin", adminLimiter, adminRoutes);
app.use("/monitoring", monitoringLimiter, monitoringRoutes);
app.use(notFoundHandler);
app.use(errorHandler);

module.exports = {
    app,
    port,
    REQUEST_TIMEOUT,
    AI_REQUEST_TIMEOUT
};
