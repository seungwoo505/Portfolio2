const express = require('express');
const collectionRoutes = require('./collection');
const statsRoutes = require('./stats');
const exportRoutes = require('./export-route');

const router = express.Router();

router.use(collectionRoutes);
router.use(statsRoutes);
router.use(exportRoutes);

module.exports = router;
