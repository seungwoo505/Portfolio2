const express = require('express');
const personalInfoRoutes = require('./personal-info');
const socialLinkRoutes = require('./social-links');

const router = express.Router();

router.use(personalInfoRoutes);
router.use(socialLinkRoutes);

module.exports = router;
export {};
