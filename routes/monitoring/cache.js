const express = require('express');
const {
    CacheUtils,
    adminOnly,
    allowedCacheClearTypes,
    buildErrorLog,
    logger,
    redisCache
} = require('./common');
const { toStringValue } = require('../../utils/filter-values');
const { getPlainBody } = require('../../utils/request-body');

const router = express.Router();

/**
 * @swagger
 * /api/monitoring/cache/clear:
 *   post:
 *     summary: 캐시 초기화
 *     tags: [Monitoring]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - type
 *             properties:
 *               type:
 *                 type: string
 *                 enum: [memory, redis, all]
 *                 example: "all"
 *     responses:
 *       200:
 *         description: 캐시 초기화 성공
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: "all 캐시가 성공적으로 초기화되었습니다."
 *       400:
 *         description: 잘못된 요청
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       500:
 *         description: 서버 오류
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.post('/cache/clear', ...adminOnly, async (req, res) => {
    try {
        const type = toStringValue(getPlainBody(req).type).trim().toLowerCase();

        if (!allowedCacheClearTypes.has(type)) {
            return res.status(400).json({
                success: false,
                message: '유효하지 않은 캐시 타입입니다. (memory, redis, all)'
            });
        }

        if (type === 'memory') {
            CacheUtils.flush();
            logger.info('메모리 캐시가 초기화되었습니다');
        } else if (type === 'redis') {
            await redisCache.flush();
            logger.info('Redis 캐시가 초기화되었습니다');
        } else if (type === 'all') {
            CacheUtils.flush();
            await redisCache.flush();
            logger.info('모든 캐시가 초기화되었습니다');
        }

        res.json({
            success: true,
            message: `${type} 캐시가 성공적으로 초기화되었습니다.`
        });
    } catch (error) {
        logger.error('캐시 초기화 실패', buildErrorLog(error, req));
        res.status(500).json({
            success: false,
            message: '캐시 초기화에 실패했습니다.'
        });
    }
});

module.exports = router;
