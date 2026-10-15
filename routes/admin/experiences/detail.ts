const express = require('express');
const { logger, buildErrorLog } = require('../common');
const Experiences = require('../../../models/experiences');
const CacheUtils = require('../../../utils/cache');
const { parsePositiveIntegerParam } = require('../../../utils/route-params');
const { authenticateToken, requirePermission, logActivity } = require('../../../middleware/auth');
const {
    getExperiencePayload,
    mapExperienceBody,
    validateRequiredExperiencePayload
} = require('./payload');

const router = express.Router();

/**
 * @swagger
 * /admin/experiences/{id}:
 *   put:
 *     summary: 경력 수정
 *     tags:
 *       - Admin - Experiences
 *     security:
 *       - bearerAuth: []
 *     description: '필요 권한: experiences.update. 현재 API는 수정 시에도 type과 title을 모두 요구합니다. 그 외 생략한 필드는 보존합니다.'
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
 *               type:
 *                 type: string
 *                 minLength: 1
 *                 example: work
 *                 description: 경력 유형. work, education, volunteer, certification 등의 문자열
 *               title:
 *                 type: string
 *                 minLength: 1
 *               company:
 *                 type: string
 *                 nullable: true
 *                 description: company_or_institution의 입력 별칭이며 둘 다 주면 company가 우선합니다.
 *               company_or_institution:
 *                 type: string
 *                 nullable: true
 *               location:
 *                 type: string
 *                 nullable: true
 *               description:
 *                 type: string
 *                 nullable: true
 *               start_date:
 *                 type: string
 *                 nullable: true
 *                 format: date
 *               end_date:
 *                 type: string
 *                 nullable: true
 *                 format: date
 *               is_current:
 *                 type: boolean
 *                 nullable: true
 *               display_order:
 *                 type: integer
 *                 nullable: true
 *             required:
 *               - type
 *               - title
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
 *                     type:
 *                       type: string
 *                       minLength: 1
 *                       example: work
 *                       description: 경력 유형. work, education, volunteer, certification 등의 문자열
 *                     title:
 *                       type: string
 *                       minLength: 1
 *                     company:
 *                       type: string
 *                       nullable: true
 *                       description: company_or_institution의 입력 별칭이며 둘 다 주면 company가 우선합니다.
 *                     company_or_institution:
 *                       type: string
 *                       nullable: true
 *                     location:
 *                       type: string
 *                       nullable: true
 *                     description:
 *                       type: string
 *                       nullable: true
 *                     start_date:
 *                       type: string
 *                       nullable: true
 *                       format: date
 *                     end_date:
 *                       type: string
 *                       nullable: true
 *                       format: date
 *                     is_current:
 *                       type: integer
 *                       enum: [0, 1, null]
 *                       nullable: true
 *                       description: mysql2가 반환한 DB BOOLEAN 값으로 0, 1 또는 null입니다.
 *                     display_order:
 *                       type: integer
 *                       nullable: true
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
 *     summary: 경력 삭제
 *     tags:
 *       - Admin - Experiences
 *     security:
 *       - bearerAuth: []
 *     description: '필요 권한: experiences.delete.'
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
router.put('/experiences/:id',
    authenticateToken,
    requirePermission('experiences.update'),
    logActivity('update_experience'),
    async (req, res) => {
        try {
            const id = parsePositiveIntegerParam(req.params.id);
            if (!id) {
                return res.status(400).json({
                    success: false,
                    message: '유효한 경력 ID가 필요합니다.'
                });
            }

            const body = getExperiencePayload(req);
            const validationError = validateRequiredExperiencePayload(body);
            if (validationError) {
                return res.status(400).json({
                    success: false,
                    message: validationError
                });
            }

            const existingExperience = await Experiences.getById(id);
            if (!existingExperience) {
                return res.status(404).json({
                    success: false,
                    message: '경력을 찾을 수 없습니다.'
                });
            }

            const mappedData = mapExperienceBody(body);
            const updatedExperience = await Experiences.update(id, mappedData);
            CacheUtils.invalidateResources('experiences');

            res.json({
                success: true,
                message: '경력이 수정되었습니다.',
                data: updatedExperience
            });
        } catch (error) {
            logger.error('관리자 경력 수정 실패', buildErrorLog(error, req));
            res.status(500).json({
                success: false,
                message: '경력 수정에 실패했습니다.'
            });
        }
    }
);

router.delete('/experiences/:id',
    authenticateToken,
    requirePermission('experiences.delete'),
    logActivity('delete_experience'),
    async (req, res) => {
        try {
            const id = parsePositiveIntegerParam(req.params.id);
            if (!id) {
                return res.status(400).json({
                    success: false,
                    message: '유효한 경력 ID가 필요합니다.'
                });
            }

            const existingExperience = await Experiences.getById(id);
            if (!existingExperience) {
                return res.status(404).json({
                    success: false,
                    message: '경력을 찾을 수 없습니다.'
                });
            }

            await Experiences.delete(id);
            CacheUtils.invalidateResources('experiences');

            res.json({
                success: true,
                message: '경력이 삭제되었습니다.'
            });
        } catch (error) {
            logger.error('관리자 경력 삭제 실패', buildErrorLog(error, req));
            res.status(500).json({
                success: false,
                message: '경력 삭제에 실패했습니다.'
            });
        }
    }
);

module.exports = router;
export {};
