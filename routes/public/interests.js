const express = require('express');
const Interests = require('../../models/interests');
const {
    cacheKey,
    cached,
    fail,
    ok,
    stableStringify,
    toStringValue
} = require('./common');

const router = express.Router();

/**
 * @swagger
 * /public/interests:
 *   get:
 *     summary: 공개 관심사 목록 조회
 *     tags: ['Public']
 */
router.get('/interests', async (req, res) => {
    try {
        const category = toStringValue(req.query.category).trim() || null;
        const key = cacheKey('interests', stableStringify({ category }));
        const data = await cached(key, () => (
            category ? Interests.getByCategory(category) : Interests.getAll()
        ));

        return ok(res, data);
    } catch (error) {
        return fail(res, error, req, '관심사 정보를 가져오는데 실패했습니다.');
    }
});

module.exports = router;
