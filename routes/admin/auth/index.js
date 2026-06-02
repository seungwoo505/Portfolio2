const express = require('express');
const profileRoutes = require('./profile');
const sessionRoutes = require('./session');

const router = express.Router();

router.use(sessionRoutes);
router.use(profileRoutes);

module.exports = router;
