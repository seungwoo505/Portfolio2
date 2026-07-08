import type { Router } from 'express';

const express = require('express');
const collectionRoutes = require('./collection');
const detailRoutes = require('./detail');
const projectRoutes = require('./projects');
const statusRoutes = require('./status');

const router: Router = express.Router();

router.use(collectionRoutes);
router.use(detailRoutes);
router.use(projectRoutes);
router.use(statusRoutes);

module.exports = router;
