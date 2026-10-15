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
 *     summary: 사이트 설정 전체 조회
 *     tags:
 *       - Admin - Settings
 *     security:
 *       - bearerAuth: []
 *     description: '필요 권한: settings.read.'
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
 *                   additionalProperties:
 *                     type: object
 *                     properties:
 *                       value: {}
 *                       type:
 *                         type: string
 *                       is_public:
 *                         type: integer
 *                         enum: [0, 1, null]
 *                         nullable: true
 *                         description: mysql2가 반환한 DB BOOLEAN 값으로 0, 1 또는 null입니다.
 *                       description:
 *                         type: string
 *                         nullable: true
 *                       updated_at:
 *                         type: string
 *                         description: DB 날짜 문자열(YYYY-MM-DD HH:mm:ss)
 *                         example: '2026-10-15 12:00:00'
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
 *       '500':
 *         description: 서버 오류
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *   put:
 *     summary: 사이트 설정 일괄 저장
 *     tags:
 *       - Admin - Settings
 *     security:
 *       - bearerAuth: []
 *     description: >-
 *       필요 권한: settings.update. 모든 설정을 하나의 트랜잭션으로 저장합니다. 각 키는 공백 제거 후 1~120자이며 value가 필수입니다. 기존 number/boolean
 *       타입을 생략해도 해당 타입으로 검증합니다.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               settings:
 *                 type: object
 *                 additionalProperties:
 *                   type: object
 *                   properties:
 *                     value:
 *                       description: 저장할 JSON 값. null도 허용합니다.
 *                     type:
 *                       type: string
 *                       enum:
 *                         - string
 *                         - number
 *                         - boolean
 *                         - json
 *                       description: 생략하면 기존 타입을 보존하고 신규 키는 string을 사용합니다.
 *                     is_public:
 *                       oneOf:
 *                         - type: boolean
 *                         - type: integer
 *                           enum:
 *                             - 0
 *                             - 1
 *                         - type: string
 *                           enum:
 *                             - 'true'
 *                             - 'false'
 *                             - '1'
 *                             - '0'
 *                             - 'yes'
 *                             - 'no'
 *                             - 'on'
 *                             - 'off'
 *                       description: 생략하면 기존 공개 여부를 보존하고 신규 키는 false입니다.
 *                     description:
 *                       type: string
 *                       nullable: true
 *                       description: 생략하면 기존 설명을 보존하고 null이면 삭제합니다.
 *                   required:
 *                     - value
 *                 example:
 *                   site_title:
 *                     value: Portfolio
 *                   page_size:
 *                     value: 20
 *                     type: number
 *                     is_public: false
 *             required:
 *               - settings
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
 *       '500':
 *         description: 서버 오류
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
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
            if (error.code === 'INVALID_SETTING_VALUE') {
                return res.status(400).json({ success: false, message: error.message });
            }
            res.status(500).json({
                success: false,
                message: '설정 업데이트에 실패했습니다.'
            });
        }
    }
);

module.exports = router;
export {};
