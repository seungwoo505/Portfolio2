import type { Router } from 'express';

const express = require('express');
const collectionRoutes = require('./collection');
const detailRoutes = require('./detail');

const router: Router = express.Router();

router.use(collectionRoutes);
router.use(detailRoutes);

module.exports = router;
