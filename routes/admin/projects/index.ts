import type { Router } from 'express';

const express = require('express');
const catalogSectionRoutes = require('./catalog-sections');
const collectionRoutes = require('./collection');
const detailRoutes = require('./detail');

const router: Router = express.Router();

router.use(collectionRoutes);
router.use(catalogSectionRoutes);
router.use(detailRoutes);

module.exports = router;
