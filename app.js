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
    adminLimiter,
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

const app = express();
const port = process.env.PORT || 3333;

app.use(generalLimiter);
configureCoreMiddleware(app);
app.use(requestTimeoutMiddleware);
configureSecurityMiddleware(app);
mountStaticAssets(app);
mountSwaggerDocs(app, { port });
app.use(requestLoggingMiddleware);

app.get("/health", (req, res) => {
    res.json(buildHealthResponse());
});

app.use("/api/public/contact", contactLimiter);
app.use("/api/public", publicRoutes);
app.use("/api/admin/login", loginLimiter);
app.use("/api/admin", adminLimiter, adminRoutes);
app.use("/api/monitoring", monitoringRoutes);
app.use(notFoundHandler);
app.use(errorHandler);

module.exports = {
    app,
    port,
    REQUEST_TIMEOUT,
    AI_REQUEST_TIMEOUT
};
