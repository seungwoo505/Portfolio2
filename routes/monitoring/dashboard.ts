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
 *     tags:
 *       - Monitoring
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       '200':
 *         description: 조회 성공
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/Success'
 *                 - type: object
 *                   properties:
 *                     data:
 *                       type: object
 *                       properties:
 *                         system:
 *                           type: object
 *                           properties:
 *                             nodeVersion:
 *                               type: string
 *                             platform:
 *                               type: string
 *                             arch:
 *                               type: string
 *                             pid:
 *                               type: integer
 *                             uptime:
 *                               type: string
 *                               example: 3600s
 *                             memory:
 *                               type: object
 *                               properties:
 *                                 rss:
 *                                   type: string
 *                                   example: 64MB
 *                                 heapTotal:
 *                                   type: string
 *                                   example: 64MB
 *                                 heapUsed:
 *                                   type: string
 *                                   example: 64MB
 *                                 external:
 *                                   type: string
 *                                   example: 64MB
 *                                 arrayBuffers:
 *                                   type: string
 *                                   example: 64MB
 *                         cache:
 *                           type: object
 *                           properties:
 *                             memory:
 *                               type: object
 *                               properties:
 *                                 hits:
 *                                   type: integer
 *                                 misses:
 *                                   type: integer
 *                                 keys:
 *                                   type: integer
 *                                 ksize:
 *                                   type: integer
 *                                 vsize:
 *                                   type: integer
 *                             redis:
 *                               type: object
 *                               properties:
 *                                 connected:
 *                                   type: boolean
 *                                 dbSize:
 *                                   type: integer
 *                                   description: Redis 연결 시 포함되는 키 개수
 *                                 memory:
 *                                   type: string
 *                                   description: Redis 연결 시 포함되는 INFO memory 원문
 *                               required:
 *                                 - connected
 *                         timestamp:
 *                           type: string
 *                           format: date-time
 *                   required:
 *                     - success
 *                     - data
 *       '401':
 *         description: 인증 토큰 누락 또는 만료
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       '403':
 *         description: super_admin 또는 admin 역할 필요
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       '408':
 *         description: 요청 처리 시간 초과
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       '429':
 *         description: 요청 횟수 제한 초과
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       '500':
 *         description: 서버 처리 중 오류 발생
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
