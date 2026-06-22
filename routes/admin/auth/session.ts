import type { Router } from 'express';

const express = require('express');
const loginRoutes = require('./session/login');
const logoutRoutes = require('./session/logout');
const refreshRoutes = require('./session/refresh');

const router: Router = express.Router();

router.use(loginRoutes);
router.use(logoutRoutes);
router.use(refreshRoutes);

module.exports = router;
