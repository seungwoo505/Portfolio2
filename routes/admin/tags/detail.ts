const express = require('express');
const Tags = require('../../../models/tags');
const CacheUtils = require('../../../utils/cache');
const { parsePositiveIntegerParam } = require('../../../utils/route-params');
const { authenticateToken, requirePermission, logActivity } = require('../../../middleware/auth');
const {
    getTagPayload,
    validateUpdateTagPayload
} = require('./payload');

const router = express.Router();

/**
 * @swagger
 * /admin/tags/{id}:
 *   put:
 *     summary: 태그 수정
 *     tags:
 *       - Admin - Tags
 *     security:
 *       - bearerAuth: []
 *     description: tags.update 권한이 필요합니다. 제공한 필드만 수정하며 name 변경 시 slug를 생략하면 기존 주소를 유지합니다.
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         description: 태그 ID
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
 *               name:
 *                 type: string
 *                 description: 태그 이름
 *                 minLength: 1
 *                 pattern: \S
 *                 maxLength: 100
 *                 example: TypeScript
 *               slug:
 *                 type: string
 *                 description: 생략하면 이름이 바뀌어도 기존 주소를 유지합니다.
 *                 nullable: true
 *                 maxLength: 120
 *               description:
 *                 type: string
 *                 description: 태그 설명
 *                 nullable: true
 *               color:
 *                 type: string
 *                 description: 색상
 *                 nullable: true
 *                 maxLength: 20
 *               type:
 *                 type: string
 *                 description: 태그 유형. 임의 문자열이며 enum 제한은 없습니다.
 *                 nullable: true
 *                 maxLength: 50
 *             minProperties: 1
 *     responses:
 *       '200':
 *         description: 수정된 태그
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
 *                           description: 태그 ID
 *                         name:
 *                           type: string
 *                           description: 태그 이름
 *                         slug:
 *                           type: string
 *                           description: 태그 주소
 *                         description:
 *                           type: string
 *                           description: 태그 설명
 *                           nullable: true
 *                         color:
 *                           type: string
 *                           description: 색상
 *                           nullable: true
 *                         type:
 *                           type: string
 *                           description: 태그 유형
 *                           nullable: true
 *                         usage_count:
 *                           type: integer
 *                           description: 사용 횟수
 *                           nullable: true
 *                         created_at:
 *                           type: string
 *                           description: DB 날짜와 시간 문자열(YYYY-MM-DD HH:mm:ss)
 *                           nullable: true
 *                         updated_at:
 *                           type: string
 *                           description: DB 날짜와 시간 문자열(YYYY-MM-DD HH:mm:ss)
 *                           nullable: true
 *                     message:
 *                       type: string
 *                       description: 처리 결과 메시지
 *                   required:
 *                     - success
 *                     - data
 *                     - message
 *       '400':
 *         description: 유효하지 않은 ID, 빈 본문 또는 비어 있는 이름
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
 *       '404':
 *         description: 태그 없음
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
 *   delete:
 *     summary: 태그 삭제
 *     tags:
 *       - Admin - Tags
 *     security:
 *       - bearerAuth: []
 *     description: tags.delete 권한이 필요합니다.
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         description: 태그 ID
 *         schema:
 *           type: integer
 *           minimum: 1
 *     responses:
 *       '200':
 *         description: 태그 및 사용 연결 삭제 완료
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
 *         description: 유효하지 않은 태그 ID
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
 *       '404':
 *         description: 태그 없음
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
router.put('/tags/:id', authenticateToken, requirePermission('tags.update'), logActivity('update_tag'), async (req, res) => {
    try {
        const tagId = parsePositiveIntegerParam(req.params.id);
        if (!tagId) {
            return res.status(400).json({ success: false, message: '유효한 태그 ID가 필요합니다.' });
        }

        const body = getTagPayload(req);
        const validationError = validateUpdateTagPayload(body);
        if (validationError) {
            return res.status(400).json({ success: false, message: validationError });
        }

        const existing = await Tags.getById(tagId);
        if (!existing) {
            return res.status(404).json({ success: false, message: '태그를 찾을 수 없습니다.' });
        }

        const updated = await Tags.update(tagId, body);
        CacheUtils.invalidateResources('tags', 'projects', 'blog');
        res.json({ success: true, message: '태그가 업데이트되었습니다.', data: updated });
    } catch (error) {
        res.status(500).json({ success: false, message: '태그 업데이트에 실패했습니다.' });
    }
});

router.delete('/tags/:id', authenticateToken, requirePermission('tags.delete'), logActivity('delete_tag'), async (req, res) => {
    try {
        const tagId = parsePositiveIntegerParam(req.params.id);
        if (!tagId) {
            return res.status(400).json({ success: false, message: '유효한 태그 ID가 필요합니다.' });
        }

        const existing = await Tags.getById(tagId);
        if (!existing) {
            return res.status(404).json({ success: false, message: '태그를 찾을 수 없습니다.' });
        }

        await Tags.delete(tagId);
        CacheUtils.invalidateResources('tags', 'projects', 'blog');
        res.json({ success: true, message: '태그가 삭제되었습니다.' });
    } catch (error) {
        res.status(500).json({ success: false, message: '태그 삭제에 실패했습니다.' });
    }
});

module.exports = router;
export {};
