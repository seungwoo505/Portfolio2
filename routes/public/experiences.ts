import type { Request, Response, Router } from 'express';

const express = require('express');
const Experiences = require('../../models/experiences');
const {
    cacheKey,
    cached,
    fail,
    ok,
    stableStringify,
    toStringValue
} = require('./common');

const router: Router = express.Router();

/**
 * @swagger
 * /public/experiences:
 *   get:
 *     summary: 공개 경력 목록 조회
 *     tags: ['Public']
 * /public/experiences/timeline:
 *   get:
 *     summary: 공개 타임라인 조회
 *     tags: ['Public']
 */
router.get('/experiences', async (req: Request, res: Response) => {
    try {
        const type = toStringValue(req.query.type).trim() || null;
        const key = cacheKey('experiences', stableStringify({ type }));
        const data = await cached(key, () => (
            type ? Experiences.getByType(type) : Experiences.getAll()
        ));

        return ok(res, data);
    } catch (error) {
        return fail(res, error, req, '경력 정보를 가져오는데 실패했습니다.');
    }
});

router.get('/experiences/timeline', async (req: Request, res: Response) => {
    try {
        const data = await cached(cacheKey('experiences', 'timeline'), () => Experiences.getTimeline());
        return ok(res, data);
    } catch (error) {
        return fail(res, error, req, '타임라인 정보를 가져오는데 실패했습니다.');
    }
});

module.exports = router;
