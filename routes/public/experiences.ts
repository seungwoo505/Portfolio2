import type { Request, Response, Router } from 'express';

const express = require('express');
const Experiences = require('../../models/experiences');
const {
    cacheKey,
    cached,
    fail,
    ok,
    stableStringify,
    toStringValue
} = require('./common');

const router: Router = express.Router();

/**
 * @swagger
 * /public/experiences:
 *   get:
 *     summary: 공개 경력 목록 조회
 *     tags:
 *       - Experiences
 *     security: []
 *     parameters:
 *       - in: query
 *         name: type
 *         required: false
 *         description: '경력 유형과 정확히 일치하는 항목. 예: work, education, volunteer, certification. 생략하면 전체 목록을 조회합니다.'
 *         schema:
 *           type: string
 *           example: work
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
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           id:
 *                             type: integer
 *                           type:
 *                             type: string
 *                           title:
 *                             type: string
 *                           company_or_institution:
 *                             type: string
 *                             nullable: true
 *                           location:
 *                             type: string
 *                             nullable: true
 *                           description:
 *                             type: string
 *                             nullable: true
 *                           start_date:
 *                             type: string
 *                             nullable: true
 *                             description: 시작 날짜
 *                           end_date:
 *                             type: string
 *                             nullable: true
 *                             description: 종료 날짜
 *                           is_current:
 *                             type: integer
 *                             enum:
 *                               - 0
 *                               - 1
 *                               - null
 *                             nullable: true
 *                             description: DB의 boolean 값(0 또는 1)
 *                           display_order:
 *                             type: integer
 *                             nullable: true
 *                           company:
 *                             type: string
 *                             nullable: true
 *                         additionalProperties: true
 *                   required:
 *                     - success
 *                     - data
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
 * /public/experiences/timeline:
 *   get:
 *     summary: 공개 타임라인 조회
 *     tags:
 *       - Experiences
 *     security: []
 *     description: 현재 경력, 종료일, 시작일 순으로 정렬하며 YYYY.MM 표시용 날짜를 포함합니다.
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
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           id:
 *                             type: integer
 *                           type:
 *                             type: string
 *                           title:
 *                             type: string
 *                           company_or_institution:
 *                             type: string
 *                             nullable: true
 *                           location:
 *                             type: string
 *                             nullable: true
 *                           description:
 *                             type: string
 *                             nullable: true
 *                           start_date:
 *                             type: string
 *                             nullable: true
 *                             description: 시작 날짜
 *                           end_date:
 *                             type: string
 *                             nullable: true
 *                             description: 종료 날짜
 *                           is_current:
 *                             type: integer
 *                             enum:
 *                               - 0
 *                               - 1
 *                               - null
 *                             nullable: true
 *                             description: DB의 boolean 값(0 또는 1)
 *                           display_order:
 *                             type: integer
 *                             nullable: true
 *                           start_date_formatted:
 *                             type: string
 *                             nullable: true
 *                           end_date_formatted:
 *                             type: string
 *                             example: 현재
 *                             description: 현재, 진행중 또는 YYYY.MM
 *                         additionalProperties: true
 *                   required:
 *                     - success
 *                     - data
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
router.get('/experiences', async (req: Request, res: Response) => {
    try {
        const type = toStringValue(req.query.type).trim() || null;
        const key = cacheKey('experiences', stableStringify({ type }));
        const data = await cached(key, () => (
            type ? Experiences.getByType(type) : Experiences.getAll()
        ));

        return ok(res, data);
    } catch (error) {
        return fail(res, error, req, '경력 정보를 가져오는데 실패했습니다.');
    }
});

router.get('/experiences/timeline', async (req: Request, res: Response) => {
    try {
        const data = await cached(cacheKey('experiences', 'timeline'), () => Experiences.getTimeline());
        return ok(res, data);
    } catch (error) {
        return fail(res, error, req, '타임라인 정보를 가져오는데 실패했습니다.');
    }
});

module.exports = router;
