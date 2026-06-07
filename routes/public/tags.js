const express = require('express');
const Tags = require('../../models/tags');
const {
    badRequest,
    cacheKey,
    cached,
    fail,
    ok,
    parsePagination,
    stableStringify,
    toOptionalBoolean,
    toStringValue
} = require('./common');

const router = express.Router();

/**
 * @swagger
 * /public/tags:
 *   get:
 *     summary: 공개 태그 목록 조회
 *     tags: ['Public']
 */
router.get('/tags', async (req, res) => {
    try {
        const { limit } = parsePagination(req.query, {
            defaultLimit: 20,
            maxLimit: 100
        });
        const type = toStringValue(req.query.type).trim() || null;
        const popular = toOptionalBoolean(req.query.popular);
        if (!popular.isValid) {
            return badRequest(res, 'popular 값은 boolean이어야 합니다.');
        }

        const popularValue = popular.value === true;
        const key = cacheKey('tags', stableStringify({ limit, type, popular: popularValue }));
        const data = await cached(key, () => (
            popularValue ? Tags.getPopular(limit, { type }) : Tags.getAll({ type })
        ));

        return ok(res, data);
    } catch (error) {
        return fail(res, error, req, '태그 정보를 가져오는데 실패했습니다.');
    }
});

module.exports = router;
