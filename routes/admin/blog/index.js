const express = require('express');
const collectionRoutes = require('./collection');
const detailRoutes = require('./detail');
const statusRoutes = require('./status');

const router = express.Router();

router.use(collectionRoutes);
router.use(detailRoutes);
router.use(statusRoutes);

module.exports = router;
