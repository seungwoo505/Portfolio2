import type { Router } from 'express';

const express = require('express');
const catalogSectionRoutes = require('./catalog-sections');
const collectionRoutes = require('./collection');
const detailRoutes = require('./detail');
const imageRoutes = require('./images');

const router: Router = express.Router();

router.use(collectionRoutes);
router.use(catalogSectionRoutes);
router.use(imageRoutes);
router.use(detailRoutes);

module.exports = router;
