const express = require('express');
const router = express.Router();

router.use(require('./auth'));
router.use(require('./users'));
router.use(require('./blog'));
router.use(require('./projects'));
router.use(require('./profile'));
router.use(require('./dashboard'));
router.use(require('./ai'));
router.use(require('./contacts'));
router.use(require('./settings'));
router.use(require('./tags'));
router.use(require('./uploads'));
router.use(require('./logs'));
router.use(require('./experiences'));
router.use(require('./interests'));
router.use(require('./skills'));

module.exports = router;
