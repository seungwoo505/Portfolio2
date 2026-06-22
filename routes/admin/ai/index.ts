import type { Router } from 'express';

const express = require('express');
const keywordsRoutes = require('./keywords');
const summarizeRoutes = require('./summarize');

const router: Router = express.Router();

router.use(summarizeRoutes);
router.use(keywordsRoutes);

module.exports = router;
