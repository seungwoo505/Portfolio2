const express = require('express');
const collectionRoutes = require('./collection');
const detailRoutes = require('./detail');

const router = express.Router();

router.use(collectionRoutes);
router.use(detailRoutes);

module.exports = router;
export {};
