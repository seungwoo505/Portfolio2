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
