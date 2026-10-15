const express = require('express');
const { logger, buildErrorLog } = require('../common');
const Interests = require('../../../models/interests');
const CacheUtils = require('../../../utils/cache');
const { parsePositiveIntegerParam } = require('../../../utils/route-params');
const { authenticateToken, requirePermission, logActivity } = require('../../../middleware/auth');
const {
    getInterestPayload,
    validateUpdateInterestPayload
} = require('./payload');

const router = express.Router();

/**
 * @swagger
 * /admin/interests/{id}:
 *   put:
 *     summary: 관심사 일부 수정
 *     tags:
 *       - Admin - Interests
 *     security:
 *       - bearerAuth: []
 *     description: '필요 권한: interests.update.'
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         description: 대상의 양의 정수 ID
 *         schema:
 *           type: integer
 *           minimum: 1
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               title:
 *                 type: string
 *                 minLength: 1
 *               category:
 *                 type: string
 *                 minLength: 1
 *               description:
 *                 type: string
 *                 nullable: true
 *               icon:
 *                 type: string
 *                 nullable: true
 *               display_order:
 *                 type: integer
 *             minProperties: 1
 *     responses:
 *       '200':
 *         description: 성공
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
 *                 data:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: integer
 *                     title:
 *                       type: string
 *                       minLength: 1
 *                     category:
 *                       type: string
 *                       minLength: 1
 *                     description:
 *                       type: string
 *                       nullable: true
 *                     icon:
 *                       type: string
 *                       nullable: true
 *                     display_order:
 *                       type: integer
 *                       default: 0
 *                   additionalProperties: true
 *       '400':
 *         description: 필수 값 누락 또는 유효하지 않은 입력
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       '401':
 *         description: 인증 토큰이 없거나 유효하지 않음
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       '403':
 *         description: 필요한 권한 또는 역할 없음
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       '404':
 *         description: 대상을 찾을 수 없음
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       '500':
 *         description: 서버 오류
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *   delete:
 *     summary: 관심사 삭제
 *     tags:
 *       - Admin - Interests
 *     security:
 *       - bearerAuth: []
 *     description: '필요 권한: interests.delete.'
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         description: 대상의 양의 정수 ID
 *         schema:
 *           type: integer
 *           minimum: 1
 *     responses:
 *       '200':
 *         description: 성공
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
 *       '400':
 *         description: 필수 값 누락 또는 유효하지 않은 입력
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       '401':
 *         description: 인증 토큰이 없거나 유효하지 않음
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       '403':
 *         description: 필요한 권한 또는 역할 없음
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       '404':
 *         description: 대상을 찾을 수 없음
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       '500':
 *         description: 서버 오류
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.put('/interests/:id',
    authenticateToken,
    requirePermission('interests.update'),
    logActivity('update_interest'),
    async (req, res) => {
        try {
            const id = parsePositiveIntegerParam(req.params.id);
            if (!id) {
                return res.status(400).json({
                    success: false,
                    message: '유효한 관심사 ID가 필요합니다.'
                });
            }

            const body = getInterestPayload(req);
            const validationError = validateUpdateInterestPayload(body);
            if (validationError) {
                return res.status(400).json({
                    success: false,
                    message: validationError
                });
            }

            const existingInterest = await Interests.getById(id);
            if (!existingInterest) {
                return res.status(404).json({
                    success: false,
                    message: '관심사를 찾을 수 없습니다.'
                });
            }

            const interest = await Interests.update(id, body);
            CacheUtils.invalidateResources('interests');

            res.json({
                success: true,
                message: '관심사가 수정되었습니다.',
                data: interest
            });
        } catch (error) {
            logger.error('관리자 관심사 수정 실패', buildErrorLog(error, req));
            res.status(500).json({
                success: false,
                message: '관심사 수정에 실패했습니다.'
            });
        }
    }
);

router.delete('/interests/:id',
    authenticateToken,
    requirePermission('interests.delete'),
    logActivity('delete_interest'),
    async (req, res) => {
        try {
            const id = parsePositiveIntegerParam(req.params.id);
            if (!id) {
                return res.status(400).json({
                    success: false,
                    message: '유효한 관심사 ID가 필요합니다.'
                });
            }

            const existingInterest = await Interests.getById(id);
            if (!existingInterest) {
                return res.status(404).json({
                    success: false,
                    message: '관심사를 찾을 수 없습니다.'
                });
            }

            await Interests.delete(id);
            CacheUtils.invalidateResources('interests');

            res.json({
                success: true,
                message: '관심사가 삭제되었습니다.'
            });
        } catch (error) {
            logger.error('관리자 관심사 삭제 실패', buildErrorLog(error, req));
            res.status(500).json({
                success: false,
                message: '관심사 삭제에 실패했습니다.'
            });
        }
    }
);

module.exports = router;
export {};
