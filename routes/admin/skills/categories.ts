const express = require('express');
const { authenticateToken, requirePermission, logActivity } = require('../../../middleware/auth');
const { parsePositiveIntegerParam } = require('../../../utils/route-params');
const { getPlainBody } = require('../../../utils/request-body');
const {
    CacheUtils,
    Skills,
    buildErrorLog,
    logger,
    toStringValue
} = require('./common');

const router = express.Router();

/**
 * @swagger
 * /admin/skills/categories:
 *   post:
 *     summary: 스킬 카테고리 생성
 *     tags:
 *       - Admin - Skills
 *     security:
 *       - bearerAuth: []
 *     description: skills.create 권한이 필요합니다. name만 입력받으며 설명은 null, 순서는 현재 최댓값+1로 생성합니다.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *                 description: 카테고리 이름
 *                 minLength: 1
 *                 pattern: \S
 *                 maxLength: 100
 *                 example: 언어
 *             required:
 *               - name
 *     responses:
 *       '201':
 *         description: 카테고리 생성 완료
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
 *                         id:
 *                           type: integer
 *                           description: 생성된 카테고리 ID
 *                         name:
 *                           type: string
 *                           description: 카테고리 이름
 *                       required:
 *                         - id
 *                         - name
 *                     message:
 *                       type: string
 *                       description: 처리 결과 메시지
 *                   required:
 *                     - success
 *                     - data
 *                     - message
 *       '400':
 *         description: 비어 있거나 중복된 카테고리 이름
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
 *         description: 해당 작업 권한이 없음
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       '500':
 *         description: 서버 또는 권한 확인 오류
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *   get:
 *     summary: 스킬 카테고리 목록 조회
 *     tags:
 *       - Admin - Skills
 *     security:
 *       - bearerAuth: []
 *     description: skills.read 권한이 필요합니다. 표시 순서대로 반환합니다.
 *     responses:
 *       '200':
 *         description: 스킬 개수를 포함한 카테고리 목록
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
 *                             description: 카테고리 ID
 *                           name:
 *                             type: string
 *                             description: 카테고리 이름
 *                           description:
 *                             type: string
 *                             description: 설명
 *                             nullable: true
 *                           display_order:
 *                             type: integer
 *                             description: 표시 순서
 *                             nullable: true
 *                           skill_count:
 *                             type: string
 *                             pattern: ^\d+$
 *                             description: 사용 중인 스킬 개수. DB COUNT(BIGINT)를 문자열로 반환합니다.
 *                             example: '3'
 *                           created_at:
 *                             type: string
 *                             description: DB 날짜와 시간 문자열(YYYY-MM-DD HH:mm:ss)
 *                             nullable: true
 *                           updated_at:
 *                             type: string
 *                             description: DB 날짜와 시간 문자열(YYYY-MM-DD HH:mm:ss)
 *                             nullable: true
 *                   required:
 *                     - success
 *                     - data
 *       '401':
 *         description: 인증 토큰이 없거나 유효하지 않음
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       '403':
 *         description: 해당 작업 권한이 없음
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       '500':
 *         description: 서버 또는 권한 확인 오류
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 * /admin/skills/categories/{id}:
 *   delete:
 *     summary: 스킬 카테고리 삭제
 *     tags:
 *       - Admin - Skills
 *     security:
 *       - bearerAuth: []
 *     description: skills.delete 권한이 필요합니다. 사용 중인 스킬이 있으면 400 응답과 함께 스킬 목록을 반환합니다.
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         description: 카테고리 ID
 *         schema:
 *           type: integer
 *           minimum: 1
 *     responses:
 *       '200':
 *         description: 카테고리 삭제 완료
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   description: 처리 성공 여부
 *                   example: true
 *                 message:
 *                   type: string
 *                   description: 처리 결과 메시지
 *               required:
 *                 - success
 *                 - message
 *       '400':
 *         description: 잘못된 ID 또는 카테고리 사용 중. 사용 중일 때만 data를 포함합니다.
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/ErrorResponse'
 *                 - type: object
 *                   properties:
 *                     data:
 *                       type: object
 *                       properties:
 *                         category_id:
 *                           type: integer
 *                           description: 카테고리 ID
 *                         skills_count:
 *                           type: integer
 *                           description: 사용 중인 스킬 개수
 *                         skills:
 *                           type: array
 *                           items:
 *                             type: object
 *                             properties:
 *                               id:
 *                                 type: integer
 *                                 description: 스킬 ID
 *                               name:
 *                                 type: string
 *                                 description: 기술명
 *       '401':
 *         description: 인증 토큰이 없거나 유효하지 않음
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       '403':
 *         description: 해당 작업 권한이 없음
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       '404':
 *         description: 카테고리 없음
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       '500':
 *         description: 서버 또는 권한 확인 오류
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.post('/skills/categories',
    authenticateToken,
    requirePermission('skills.create'),
    logActivity('create_skill_category'),
    async (req, res) => {
        try {
            const body = getPlainBody(req);
            const name = toStringValue(body.name).trim();

            if (!name) {
                return res.status(400).json({
                    success: false,
                    message: '카테고리명을 입력해주세요.'
                });
            }
            const existingCategory = await Skills.getCategoryByName(name);

            if (existingCategory) {
                return res.status(400).json({
                    success: false,
                    message: '이미 존재하는 카테고리명입니다.'
                });
            }

            const categoryId = await Skills.createCategory(name);
            CacheUtils.invalidateResources('skills', 'projects');

            res.status(201).json({
                success: true,
                message: '카테고리가 성공적으로 추가되었습니다.',
                data: { id: categoryId, name }
            });
        } catch (error) {
            logger.error('카테고리 추가 실패', buildErrorLog(error, req));
            res.status(500).json({
                success: false,
                message: '카테고리 추가에 실패했습니다.'
            });
        }
    }
);

router.delete('/skills/categories/:id',
    authenticateToken,
    requirePermission('skills.delete'),
    logActivity('delete_skill_category'),
    async (req, res) => {
        try {
            const categoryId = parsePositiveIntegerParam(req.params.id);

            if (!categoryId) {
                return res.status(400).json({
                    success: false,
                    message: '유효한 카테고리 ID가 필요합니다.'
                });
            }

            const existingCategory = await Skills.getCategoryById(categoryId);
            if (!existingCategory) {
                return res.status(404).json({
                    success: false,
                    message: '카테고리를 찾을 수 없습니다.'
                });
            }

            const deleted = await Skills.deleteCategory(categoryId);
            if (deleted === false) {
                return res.status(404).json({ success: false, message: '카테고리를 찾을 수 없습니다.' });
            }
            CacheUtils.invalidateResources('skills', 'projects');

            res.json({
                success: true,
                message: '카테고리가 성공적으로 삭제되었습니다.'
            });
        } catch (error) {
            if (error?.code === 'SKILL_CATEGORY_IN_USE') {
                return res.status(400).json({
                    success: false,
                    message: '이 카테고리를 사용하는 기술 스택이 있어서 삭제할 수 없습니다.',
                    data: {
                        category_id: error.categoryId,
                        skills_count: error.skills.length,
                        skills: error.skills.map(skill => ({ id: skill.id, name: skill.name }))
                    }
                });
            }
            logger.error('카테고리 삭제 실패', buildErrorLog(error, req));
            res.status(500).json({
                success: false,
                message: '카테고리 삭제에 실패했습니다.'
            });
        }
    }
);

router.get('/skills/categories',
    authenticateToken,
    requirePermission('skills.read'),
    async (req, res) => {
        try {
            const categories = await Skills.getCategories();

            res.json({
                success: true,
                data: categories
            });
        } catch (error) {
            logger.error('카테고리 목록 조회 실패', buildErrorLog(error, req));
            res.status(500).json({
                success: false,
                message: '카테고리 목록을 가져오는데 실패했습니다.'
            });
        }
    }
);

module.exports = router;
export {};
