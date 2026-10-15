import type { Request, Response, Router } from 'express';
import type { RowDataPacket } from 'mysql2';

const express = require('express');
const {
    adminOnly,
    buildErrorLog,
    logger,
    redisCache
} = require('./common');

const router: Router = express.Router();

type DbHealthRow = RowDataPacket & {
    test: number;
};

type DbPool = {
    execute<T = unknown>(sql: string, values?: unknown[]): Promise<[T, unknown]>;
};

/**
 * @swagger
 * /monitoring/metrics:
 *   get:
 *     summary: 시스템 메트릭 조회
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
 *                         database:
 *                           type: object
 *                           properties:
 *                             connected:
 *                               type: boolean
 *                             responseTime:
 *                               type: string
 *                               example: 42ms
 *                         redis:
 *                           type: object
 *                           properties:
 *                             connected:
 *                               type: boolean
 *                             responseTime:
 *                               type: string
 *                               example: 15ms
 *                         memory:
 *                           type: object
 *                           properties:
 *                             rss:
 *                               type: integer
 *                               minimum: 0
 *                               description: 바이트
 *                             heapTotal:
 *                               type: integer
 *                               minimum: 0
 *                               description: 바이트
 *                             heapUsed:
 *                               type: integer
 *                               minimum: 0
 *                               description: 바이트
 *                             external:
 *                               type: integer
 *                               minimum: 0
 *                               description: 바이트
 *                             arrayBuffers:
 *                               type: integer
 *                               minimum: 0
 *                               description: 바이트
 *                         uptime:
 *                           type: number
 *                           description: 프로세스 실행 시간(초)
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
router.get('/metrics', ...adminOnly, async (req: Request, res: Response) => {
    try {
        const startTime = Date.now();

        const db = require('../../db') as DbPool;
        const [dbResult] = await db.execute<DbHealthRow[]>('SELECT 1 as test');
        const dbResponseTime = Date.now() - startTime;

        const redisStartTime = Date.now();
        const redisConnected = await redisCache.ping();
        const redisResponseTime = Date.now() - redisStartTime;

        const metrics = {
            database: {
                connected: dbResult && dbResult.length > 0,
                responseTime: `${dbResponseTime}ms`
            },
            redis: {
                connected: redisConnected,
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
