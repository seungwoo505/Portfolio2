const express = require('express');
const router = express.Router();
const SiteSettings = require('../../models/site-settings');
const CacheUtils = require('../../utils/cache');
const { authenticateToken, requirePermission, logActivity } = require('../../middleware/auth');

/**
 * @swagger
 * /api/admin/settings:
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
            const { settings } = req.body || {};

            if (!settings || typeof settings !== 'object' || Array.isArray(settings)) {
                return res.status(400).json({
                    success: false,
                    message: 'settings 객체가 필요합니다.'
                });
            }

            for (const [key, config] of Object.entries(settings)) {
                if (!key.trim() || !config || typeof config !== 'object' || Array.isArray(config)) {
                    return res.status(400).json({
                        success: false,
                        message: '각 설정은 유효한 key와 설정 객체를 가져야 합니다.'
                    });
                }

                if (!Object.prototype.hasOwnProperty.call(config, 'value')) {
                    return res.status(400).json({
                        success: false,
                        message: `${key} 설정에는 value가 필요합니다.`
                    });
                }
            }

            await SiteSettings.setMany(settings);
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
