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
 * /api/admin/tags/{id}:
 *   put:
 *     summary: 태그 수정
 *     tags: ['Admin - Tags']
 *   delete:
 *     summary: 태그 삭제
 *     tags: ['Admin - Tags']
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
