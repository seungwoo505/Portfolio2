const express = require('express');
const collectionRoutes = require('./collection');
const actionRoutes = require('./actions');

const router = express.Router();

router.use(collectionRoutes);
router.use(actionRoutes);

module.exports = router;
export {};
