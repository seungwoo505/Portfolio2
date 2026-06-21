import type { Router } from 'express';

const express = require('express');
const profileRoutes = require('./profile');
const contactRoutes = require('./contact');
const skillsRoutes = require('./skills');
const projectsRoutes = require('./projects');
const postsRoutes = require('./posts');
const tagsRoutes = require('./tags');
const experiencesRoutes = require('./experiences');
const interestsRoutes = require('./interests');

const router: Router = express.Router();

router.use(profileRoutes);
router.use(contactRoutes);
router.use(skillsRoutes);
router.use(projectsRoutes);
router.use(postsRoutes);
router.use(tagsRoutes);
router.use(experiencesRoutes);
router.use(interestsRoutes);

module.exports = router;
