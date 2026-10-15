import type { Request, Response, Router } from 'express';

const express = require('express');
const Interests = require('../../models/interests');
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
 * /public/interests:
 *   get:
 *     summary: 공개 관심사 목록 조회
 *     tags:
 *       - Interests
 *     security: []
 *     parameters:
 *       - in: query
 *         name: category
 *         required: false
 *         description: 카테고리와 정확히 일치하는 관심사. 생략하면 전체 목록을 조회합니다.
 *         schema:
 *           type: string
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
 *                           title:
 *                             type: string
 *                           description:
 *                             type: string
 *                             nullable: true
 *                           icon:
 *                             type: string
 *                             nullable: true
 *                           category:
 *                             type: string
 *                           display_order:
 *                             type: integer
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
 */
router.get('/interests', async (req: Request, res: Response) => {
    try {
        const category = toStringValue(req.query.category).trim() || null;
        const key = cacheKey('interests', stableStringify({ category }));
        const data = await cached(key, () => (
            category ? Interests.getByCategory(category) : Interests.getAll()
        ));

        return ok(res, data);
    } catch (error) {
        return fail(res, error, req, '관심사 정보를 가져오는데 실패했습니다.');
    }
});

module.exports = router;
