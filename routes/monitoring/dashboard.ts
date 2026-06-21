import type { Request, Response, Router } from 'express';

const express = require('express');
const {
    CacheUtils,
    adminOnly,
    buildErrorLog,
    logger,
    redisCache
} = require('./common');

const router: Router = express.Router();

/**
 * @swagger
 * /monitoring/dashboard:
 *   get:
 *     summary: 시스템 모니터링 대시보드
 *     tags: [Monitoring]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: 모니터링 데이터 조회 성공
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
 *                     system:
 *                       type: object
 *                       properties:
 *                         nodeVersion:
 *                           type: string
 *                           example: "v18.18.0"
 *                         platform:
 *                           type: string
 *                           example: "darwin"
 *                         uptime:
 *                           type: string
 *                           example: "3600s"
 *                     cache:
 *                       type: object
 *                       properties:
 *                         memory:
 *                           type: object
 *                         redis:
 *                           type: object
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
router.get('/dashboard', ...adminOnly, async (req: Request, res: Response) => {
    try {
        const memoryUsage = process.memoryUsage();
        const uptime = process.uptime();

        const memoryCacheStats = CacheUtils.getStats();
        const redisStats = await redisCache.getStats();

        const systemInfo = {
            nodeVersion: process.version,
            platform: process.platform,
            arch: process.arch,
            pid: process.pid,
            uptime: `${Math.floor(uptime)}s`,
            memory: {
                rss: `${Math.round(memoryUsage.rss / 1024 / 1024)}MB`,
                heapTotal: `${Math.round(memoryUsage.heapTotal / 1024 / 1024)}MB`,
                heapUsed: `${Math.round(memoryUsage.heapUsed / 1024 / 1024)}MB`,
                external: `${Math.round(memoryUsage.external / 1024 / 1024)}MB`,
                arrayBuffers: `${Math.round(memoryUsage.arrayBuffers / 1024 / 1024)}MB`
            }
        };

        res.json({
            success: true,
            data: {
                system: systemInfo,
                cache: {
                    memory: memoryCacheStats,
                    redis: redisStats
                },
                timestamp: new Date().toISOString()
            }
        });
    } catch (error) {
        logger.error('모니터링 대시보드 조회 실패', buildErrorLog(error, req));
        res.status(500).json({
            success: false,
            message: '모니터링 데이터를 가져오는데 실패했습니다.'
        });
    }
});

module.exports = router;
