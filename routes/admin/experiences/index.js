const express = require('express');
const collectionRoutes = require('./collection');
const timelineRoutes = require('./timeline');
const detailRoutes = require('./detail');

const router = express.Router();

router.use(collectionRoutes);
router.use(timelineRoutes);
router.use(detailRoutes);

module.exports = router;
