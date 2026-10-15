import type { Request, Response, Router } from 'express';

const express = require('express');
const Tags = require('../../models/tags');
const {
    badRequest,
    cacheKey,
    cached,
    fail,
    ok,
    parsePagination,
    stableStringify,
    toOptionalBoolean,
    toStringValue
} = require('./common');

const router: Router = express.Router();

/**
 * @swagger
 * /public/tags:
 *   get:
 *     summary: 공개 태그 목록 조회
 *     tags:
 *       - Tags
 *     security: []
 *     description: 사용 횟수 내림차순, 이름 오름차순으로 반환합니다. 인기 태그 조회 외에는 페이지 크기 제한이 없습니다.
 *     parameters:
 *       - in: query
 *         name: type
 *         required: false
 *         description: 태그 유형과 정확히 일치하는 항목만 반환합니다. 생략하면 모든 유형을 조회합니다.
 *         schema:
 *           type: string
 *       - in: query
 *         name: popular
 *         required: false
 *         description: true/1/yes/on이면 사용 횟수가 1 이상인 태그를 조회합니다. false/0/no/off 또는 생략이면 전체 목록을 조회합니다. 다른 값은 400입니다.
 *         schema:
 *           type: boolean
 *           default: false
 *       - in: query
 *         name: limit
 *         required: false
 *         description: popular=true일 때만 적용됩니다. 범위를 벗어난 정수는 1~100으로 보정하고, 정수가 아니면 20을 사용합니다.
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 100
 *           default: 20
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
 *                           name:
 *                             type: string
 *                           slug:
 *                             type: string
 *                           description:
 *                             type: string
 *                             nullable: true
 *                           color:
 *                             type: string
 *                             nullable: true
 *                           type:
 *                             type: string
 *                             nullable: true
 *                           usage_count:
 *                             type: integer
 *                         additionalProperties: true
 *                   required:
 *                     - success
 *                     - data
 *       '400':
 *         description: 요청 값 또는 형식이 올바르지 않음
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
router.get('/tags', async (req: Request, res: Response) => {
    try {
        const { limit } = parsePagination(req.query, {
            defaultLimit: 20,
            maxLimit: 100
        });
        const type = toStringValue(req.query.type).trim() || null;
        const popular = toOptionalBoolean(req.query.popular);
        if (!popular.isValid) {
            return badRequest(res, 'popular 값은 boolean이어야 합니다.');
        }

        const popularValue = popular.value === true;
        const key = cacheKey('tags', stableStringify({ limit, type, popular: popularValue }));
        const data = await cached(key, () => (
            popularValue ? Tags.getPopular(limit, { type }) : Tags.getAll({ type })
        ));

        return ok(res, data);
    } catch (error) {
        return fail(res, error, req, '태그 정보를 가져오는데 실패했습니다.');
    }
});

module.exports = router;
