/**
 * @swagger
 * /api/monitoring/dashboard:
 *   get:
 *     summary: 시스템 모니터링 대시보드
 *     tags: [Monitoring]
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
 * /api/monitoring/cache/clear:
 *   post:
 *     summary: 캐시 초기화
 *     tags: [Monitoring]
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
 * /api/monitoring/metrics:
 *   get:
 *     summary: 시스템 메트릭 조회
 *     tags: [Monitoring]
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
const express = require('express');
const router = express.Router();
const logger = require('../log');
const CacheUtils = require('../utils/cache');
const redisCache = require('../utils/redis-cache');

router.get('/dashboard', async (req, res) => {
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
        logger.error('모니터링 대시보드 조회 실패', { error: error.message });
        res.status(500).json({
            success: false,
            error: '모니터링 데이터를 가져오는데 실패했습니다.'
        });
    }
});

router.post('/cache/clear', async (req, res) => {
    try {
        const { type } = req.body;
        
        if (type === 'memory') {
            CacheUtils.clear();
            logger.info('메모리 캐시가 초기화되었습니다');
        } else if (type === 'redis') {
            await redisCache.flush();
            logger.info('Redis 캐시가 초기화되었습니다');
        } else if (type === 'all') {
            CacheUtils.clear();
            await redisCache.flush();
            logger.info('모든 캐시가 초기화되었습니다');
        } else {
            return res.status(400).json({
                success: false,
                error: '유효하지 않은 캐시 타입입니다. (memory, redis, all)'
            });
        }

        res.json({
            success: true,
            message: `${type} 캐시가 성공적으로 초기화되었습니다.`
        });
    } catch (error) {
        logger.error('캐시 초기화 실패', { error: error.message });
        res.status(500).json({
            success: false,
            error: '캐시 초기화에 실패했습니다.'
        });
    }
});

router.get('/metrics', async (req, res) => {
    try {
        const startTime = Date.now();
        
        const db = require('../db');
        const [dbResult] = await db.execute('SELECT 1 as test');
        const dbResponseTime = Date.now() - startTime;
        
        const redisStartTime = Date.now();
        const redisTest = await redisCache.get('test');
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
        logger.error('메트릭 조회 실패', { error: error.message });
        res.status(500).json({
            success: false,
            error: '메트릭을 가져오는데 실패했습니다.'
        });
    }
});

module.exports = router;
