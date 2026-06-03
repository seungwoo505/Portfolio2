const express = require('express');
const Tags = require('../../../models/tags');
const CacheUtils = require('../../../utils/cache');
const { toOptionalBoolean, toStringValue } = require('../../../utils/filter-values');
const { authenticateToken, requirePermission, logActivity } = require('../../../middleware/auth');
const {
    getTagPayload,
    validateCreateTagPayload
} = require('./payload');

const router = express.Router();

/**
 * @swagger
 * /api/admin/tags:
 *   get:
 *     summary: 태그 목록 조회 (관리자)
 *     tags: ['Admin - Tags']
 *   post:
 *     summary: 태그 생성
 *     tags: ['Admin - Tags']
 */
router.get('/tags', authenticateToken, requirePermission('tags.read'), async (req, res) => {
    try {
        const type = toStringValue(req.query.type).trim() || null;
        const popular = toOptionalBoolean(req.query.popular);
        if (!popular.isValid) {
            return res.status(400).json({ success: false, message: 'popular 값은 boolean이어야 합니다.' });
        }

        const tags = popular.value === true
            ? await Tags.getPopular(50, { type })
            : await Tags.getAll({ type });

        res.json({ success: true, data: tags });
    } catch (error) {
        res.status(500).json({ success: false, message: '태그 목록을 가져오는데 실패했습니다.' });
    }
});

router.post('/tags', authenticateToken, requirePermission('tags.create'), logActivity('create_tag'), async (req, res) => {
    try {
        const body = getTagPayload(req);
        const validationError = validateCreateTagPayload(body);
        if (validationError) {
            return res.status(400).json({ success: false, message: validationError });
        }

        const { name, slug, description, color, type } = body;
        const id = await Tags.create({ name, slug, description, color, type });
        const created = await Tags.getById(id);
        CacheUtils.invalidateResources('tags', 'projects', 'blog');
        res.status(201).json({ success: true, message: '태그가 생성되었습니다.', data: created });
    } catch (error) {
        res.status(500).json({ success: false, message: '태그 생성에 실패했습니다.' });
    }
});

module.exports = router;
