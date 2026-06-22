const express = require('express');
const categoryRoutes = require('./categories');
const crudRoutes = require('./crud');
const actionRoutes = require('./actions');

const router = express.Router();

router.use(categoryRoutes);
router.use(crudRoutes);
router.use(actionRoutes);

module.exports = router;
export {};
