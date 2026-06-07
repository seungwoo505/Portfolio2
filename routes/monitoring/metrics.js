const express = require('express');
const {
    adminOnly,
    buildErrorLog,
    logger,
    redisCache
} = require('./common');

const router = express.Router();

/**
 * @swagger
 * /monitoring/metrics:
 *   get:
 *     summary: 시스템 메트릭 조회
 *     tags: [Monitoring]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: 메트릭 조회 성공
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: object
 *                   properties:
 *                     database:
 *                       type: object
 *                       properties:
 *                         connected:
 *                           type: boolean
 *                           example: true
 *                         responseTime:
 *                           type: string
 *                           example: "42ms"
 *                     redis:
 *                       type: object
 *                       properties:
 *                         connected:
 *                           type: boolean
 *                           example: true
 *                         responseTime:
 *                           type: string
 *                           example: "15ms"
 *                     uptime:
 *                       type: number
 *                       example: 1234.56
 *                     timestamp:
 *                       type: string
 *                       format: date-time
 *       500:
 *         description: 서버 오류
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.get('/metrics', ...adminOnly, async (req, res) => {
    try {
        const startTime = Date.now();

        const db = require('../../db');
        const [dbResult] = await db.execute('SELECT 1 as test');
        const dbResponseTime = Date.now() - startTime;

        const redisStartTime = Date.now();
        await redisCache.get('test');
        const redisResponseTime = Date.now() - redisStartTime;

        const metrics = {
            database: {
                connected: dbResult && dbResult.length > 0,
                responseTime: `${dbResponseTime}ms`
            },
            redis: {
                connected: redisCache.isConnected,
                responseTime: `${redisResponseTime}ms`
            },
            memory: process.memoryUsage(),
            uptime: process.uptime(),
            timestamp: new Date().toISOString()
        };

        res.json({
            success: true,
            data: metrics
        });
    } catch (error) {
        logger.error('메트릭 조회 실패', buildErrorLog(error, req));
        res.status(500).json({
            success: false,
            message: '메트릭을 가져오는데 실패했습니다.'
        });
    }
});

module.exports = router;
