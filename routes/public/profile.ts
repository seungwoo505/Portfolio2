import type { Request, Response, Router } from 'express';

const express = require('express');
const PersonalInfo = require('../../models/personal-info');
const SocialLinks = require('../../models/social-links');
const SiteSettings = require('../../models/site-settings');
const { cacheKey, cached, fail, ok } = require('./common');

const router: Router = express.Router();

/**
 * @swagger
 * /public/profile:
 *   get:
 *     summary: 공개 프로필 조회
 *     tags: ['Public']
 * /public/settings:
 *   get:
 *     summary: 공개 사이트 설정 조회
 *     tags: ['Public']
 * /public/social-links:
 *   get:
 *     summary: 공개 소셜 링크 조회
 *     tags: ['Public']
 */
router.get('/profile', async (req: Request, res: Response) => {
    try {
        const data = await cached(cacheKey('personal_info', 'profile'), () => PersonalInfo.get());
        return ok(res, data);
    } catch (error) {
        return fail(res, error, req, '프로필 정보를 가져오는데 실패했습니다.');
    }
});

router.get('/settings', async (req: Request, res: Response) => {
    try {
        const data = await cached(cacheKey('settings', 'public'), () => SiteSettings.getPublicSettings());
        return ok(res, data);
    } catch (error) {
        return fail(res, error, req, '공개 설정 정보를 가져오는데 실패했습니다.');
    }
});

router.get('/social-links', async (req: Request, res: Response) => {
    try {
        const data = await cached(cacheKey('social_links', 'all'), () => SocialLinks.getAll());
        return ok(res, data);
    } catch (error) {
        return fail(res, error, req, '소셜 링크를 가져오는데 실패했습니다.');
    }
});

module.exports = router;
