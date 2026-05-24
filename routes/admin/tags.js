const express = require('express');
const router = express.Router();
const Tags = require('../../models/tags');
const CacheUtils = require('../../utils/cache');
const { toBooleanOrNull, toStringValue } = require('../../utils/filter-values');
const {
    getPlainBody,
    hasInvalidProvidedStringFields,
    hasRequiredStringFields,
    trimStringFields
} = require('../../utils/request-body');
const { authenticateToken, requirePermission, logActivity } = require('../../middleware/auth');

const tagStringFields = ['name', 'slug', 'description', 'color', 'type'];

/**
 * @swagger
 * /api/admin/tags:
 *   get:
 *     summary: 태그 목록 조회 (관리자)
 *     tags: ['Admin - Tags']
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: type
 *         schema:
 *           type: string
 *       - in: query
 *         name: popular
 *         schema:
 *           type: boolean
 *           description: 인기 태그만 조회
 *     responses:
 *       200:
 *         description: 태그 조회 성공
 *   post:
 *     summary: 태그 생성
 *     tags: ['Admin - Tags']
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - name
 *             properties:
 *               name:
 *                 type: string
 *               slug:
 *                 type: string
 *               description:
 *                 type: string
 *               color:
 *                 type: string
 *               type:
 *                 type: string
 *     responses:
 *       201:
 *         description: 태그 생성 성공
 *       400:
 *         description: 잘못된 요청
 *       500:
 *         description: 서버 오류
 */
router.get('/tags', authenticateToken, requirePermission('tags.read'), async (req, res) => {
    try {
        const type = toStringValue(req.query.type).trim() || null;
        const popular = toBooleanOrNull(req.query.popular);
        let tags;
        if (popular === true) {
            tags = await Tags.getPopular(50, { type });
        } else {
            tags = await Tags.getAll({ type });
        }
        res.json({ success: true, data: tags });
    } catch (error) {
        res.status(500).json({ success: false, message: '태그 목록을 가져오는데 실패했습니다.' });
    }
});

router.post('/tags', authenticateToken, requirePermission('tags.create'), logActivity('create_tag'), async (req, res) => {
    try {
        const body = trimStringFields(getPlainBody(req), tagStringFields);
        const { name, slug, description, color, type } = body;
        if (!hasRequiredStringFields(body, ['name'])) {
            return res.status(400).json({ success: false, message: '태그 이름은 필수입니다.' });
        }
        const id = await Tags.create({ name, slug, description, color, type });
        const created = await Tags.getById(id);
        CacheUtils.invalidateResources('tags', 'projects', 'blog');
        res.status(201).json({ success: true, message: '태그가 생성되었습니다.', data: created });
    } catch (error) {
        res.status(500).json({ success: false, message: '태그 생성에 실패했습니다.' });
    }
});

/**
 * @swagger
 * /api/admin/tags/{id}:
 *   put:
 *     summary: 태그 수정
 *     tags: ['Admin - Tags']
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             additionalProperties: true
 *     responses:
 *       200:
 *         description: 태그 수정 성공
 *       500:
 *         description: 서버 오류
 *   delete:
 *     summary: 태그 삭제
 *     tags: ['Admin - Tags']
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: 태그 삭제 성공
 *       500:
 *         description: 서버 오류
 */
router.put('/tags/:id', authenticateToken, requirePermission('tags.update'), logActivity('update_tag'), async (req, res) => {
    try {
        const body = trimStringFields(getPlainBody(req), tagStringFields);

        if (Object.keys(body).length === 0) {
            return res.status(400).json({ success: false, message: '수정할 태그 정보가 필요합니다.' });
        }

        if (hasInvalidProvidedStringFields(body, ['name'])) {
            return res.status(400).json({ success: false, message: '태그 이름은 비어 있을 수 없습니다.' });
        }

        const updated = await Tags.update(req.params.id, body);
        CacheUtils.invalidateResources('tags', 'projects', 'blog');
        res.json({ success: true, message: '태그가 업데이트되었습니다.', data: updated });
    } catch (error) {
        res.status(500).json({ success: false, message: '태그 업데이트에 실패했습니다.' });
    }
});

router.delete('/tags/:id', authenticateToken, requirePermission('tags.delete'), logActivity('delete_tag'), async (req, res) => {
    try {
        await Tags.delete(req.params.id);
        CacheUtils.invalidateResources('tags', 'projects', 'blog');
        res.json({ success: true, message: '태그가 삭제되었습니다.' });
    } catch (error) {
        res.status(500).json({ success: false, message: '태그 삭제에 실패했습니다.' });
    }
});

module.exports = router;
