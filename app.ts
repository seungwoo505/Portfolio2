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

app.use(generalLimiter);
configureCoreMiddleware(app);
app.use(requestTimeoutMiddleware);
configureSecurityMiddleware(app);
mountStaticAssets(app);
mountSwaggerDocs(app, { port });
app.use(requestLoggingMiddleware);
app.use(apiResponseNormalizer);

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
