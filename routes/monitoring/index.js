const express = require('express');
const cacheRoutes = require('./cache');
const dashboardRoutes = require('./dashboard');
const metricsRoutes = require('./metrics');

const router = express.Router();

router.use(dashboardRoutes);
router.use(cacheRoutes);
router.use(metricsRoutes);

module.exports = router;
