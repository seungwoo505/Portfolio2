import type { Router } from 'express';

const express = require('express');
const cacheRoutes = require('./cache');
const dashboardRoutes = require('./dashboard');
const metricsRoutes = require('./metrics');

const router: Router = express.Router();

router.use(dashboardRoutes);
router.use(cacheRoutes);
router.use(metricsRoutes);

module.exports = router;
