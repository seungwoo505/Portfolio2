import type { Request, Response, Router } from 'express';

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

const router: Router = express.Router();

/**
 * @swagger
 * /monitoring/cache/clear:
 *   post:
 *     summary: 캐시 초기화
 *     tags:
 *       - Monitoring
 *     security:
 *       - bearerAuth: []
 *     description: 캐시 종류의 앞뒤 공백과 대소문자를 정규화합니다.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               type:
 *                 type: string
 *                 enum:
 *                   - memory
 *                   - redis
 *                   - all
 *                 example: all
 *             required:
 *               - type
 *     responses:
 *       '200':
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
 *                   example: all 캐시가 성공적으로 초기화되었습니다.
 *               required:
 *                 - success
 *                 - message
 *       '400':
 *         description: 요청 값 또는 형식이 올바르지 않음
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
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
 *       '503':
 *         description: Redis 연결 또는 초기화 실패. 전체 초기화 요청이면 메모리 캐시도 유지합니다.
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
router.post('/cache/clear', ...adminOnly, async (req: Request, res: Response) => {
    try {
        const type = toStringValue(getPlainBody(req).type).trim().toLowerCase();

        if (!allowedCacheClearTypes.has(type)) {
            return res.status(400).json({
                success: false,
                message: '유효하지 않은 캐시 타입입니다. (memory, redis, all)'
            });
        }

        if (type === 'redis' || type === 'all') {
            const cleared = await redisCache.flush();
            if (!cleared) {
                return res.status(503).json({
                    success: false,
                    message: 'Redis 캐시 초기화에 실패했습니다. 잠시 후 다시 시도해주세요.'
                });
            }
            logger.info('Redis 캐시가 초기화되었습니다');
        }
        if (type === 'memory' || type === 'all') {
            CacheUtils.flush();
            logger.info('메모리 캐시가 초기화되었습니다');
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
