const express = require('express');
const router = express.Router();
const SiteSettings = require('../../models/site-settings');
const CacheUtils = require('../../utils/cache');
const { getPlainBody } = require('../../utils/request-body');
const { authenticateToken, requirePermission, logActivity } = require('../../middleware/auth');
const { normalizeSettingsPayload } = require('./settings/validation');

/**
 * @swagger
 * /admin/settings:
 *   get:
 *     summary: 사이트 설정 조회
 *     tags: ['Admin - Settings']
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: 설정 조회 성공
 *       500:
 *         description: 서버 오류
 *   put:
 *     summary: 사이트 설정 업데이트
 *     tags: ['Admin - Settings']
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               settings:
 *                 type: object
 *                 additionalProperties: true
 *     responses:
 *       200:
 *         description: 설정 업데이트 성공
 *       400:
 *         description: 잘못된 요청
 *       500:
 *         description: 서버 오류
 */
router.get('/settings', authenticateToken, requirePermission('settings.read'), async (req, res) => {
    try {
        const settings = await SiteSettings.getAllSettings();

        res.json({
            success: true,
            data: settings
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: '설정을 가져오는데 실패했습니다.'
        });
    }
});

router.put('/settings',
    authenticateToken,
    requirePermission('settings.update'),
    logActivity('update_settings'),
    async (req, res) => {
        try {
            const { settings } = getPlainBody(req);
            const normalized = normalizeSettingsPayload(settings);
            if (normalized.error) {
                return res.status(400).json({
                    success: false,
                    message: normalized.error
                });
            }

            await SiteSettings.setMany(normalized.settings);
            CacheUtils.invalidateResources('settings');

            res.json({
                success: true,
                message: '설정이 업데이트되었습니다.'
            });
        } catch (error) {
            res.status(500).json({
                success: false,
                message: '설정 업데이트에 실패했습니다.'
            });
        }
    }
);

module.exports = router;
