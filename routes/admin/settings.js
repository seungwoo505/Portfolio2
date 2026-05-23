const express = require('express');
const router = express.Router();
const SiteSettings = require('../../models/site-settings');
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
            const { settings } = req.body;

            for (const [key, config] of Object.entries(settings)) {
                await SiteSettings.set(
                    key,
                    config.value,
                    config.type,
                    config.is_public,
                    config.description
                );
            }

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

