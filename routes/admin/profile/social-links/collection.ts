const express = require('express');
const { logger, buildErrorLog } = require('../../common');
const SocialLinks = require('../../../../models/social-links');
const CacheUtils = require('../../../../utils/cache');
const { authenticateToken, requirePermission, logActivity } = require('../../../../middleware/auth');
const {
    getSocialLinkPayload,
    validateCreateSocialLinkPayload
} = require('./payload');

const router = express.Router();

/**
 * @swagger
 * /admin/social-links:
 *   get:
 *     summary: 소셜 링크 목록 조회
 *     tags:
 *       - Admin - Profile
 *     security:
 *       - bearerAuth: []
 *     description: '필요 권한: social_links.read. 비활성 링크도 포함합니다.'
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
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       id:
 *                         type: integer
 *                       platform:
 *                         type: string
 *                         minLength: 1
 *                       url:
 *                         type: string
 *                         minLength: 1
 *                         example: https://example.com
 *                       icon:
 *                         type: string
 *                         nullable: true
 *                       display_order:
 *                         type: integer
 *                         default: 0
 *                       is_active:
 *                         oneOf:
 *                           - type: boolean
 *                           - type: integer
 *                             enum:
 *                               - 0
 *                               - 1
 *                           - type: string
 *                             enum:
 *                               - 'true'
 *                               - 'false'
 *                               - '1'
 *                               - '0'
 *                               - 'yes'
 *                               - 'no'
 *                               - 'on'
 *                               - 'off'
 *                         description: boolean 또는 대응하는 숫자·문자열을 허용합니다.
 *                         default: true
 *                     additionalProperties: true
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
 *   post:
 *     summary: 소셜 링크 생성
 *     tags:
 *       - Admin - Profile
 *     security:
 *       - bearerAuth: []
 *     description: '필요 권한: social_links.create.'
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               platform:
 *                 type: string
 *                 minLength: 1
 *               url:
 *                 type: string
 *                 minLength: 1
 *                 example: https://example.com
 *               icon:
 *                 type: string
 *                 nullable: true
 *               display_order:
 *                 type: integer
 *                 default: 0
 *               is_active:
 *                 type: boolean
 *                 default: true
 *             required:
 *               - platform
 *               - url
 *     responses:
 *       '201':
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
 *                     platform:
 *                       type: string
 *                       minLength: 1
 *                     url:
 *                       type: string
 *                       minLength: 1
 *                       example: https://example.com
 *                     icon:
 *                       type: string
 *                       nullable: true
 *                     display_order:
 *                       type: integer
 *                       default: 0
 *                     is_active:
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
 *                       description: boolean 또는 대응하는 숫자·문자열을 허용합니다.
 *                       default: true
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
 *       '500':
 *         description: 서버 오류
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.get('/social-links',
    authenticateToken,
    requirePermission('social_links.read'),
    async (req, res) => {
        try {
            const links = await SocialLinks.getAll({ includeInactive: true });
            res.json({ success: true, data: links });
        } catch (error) {
            logger.error('소셜 링크 조회 실패', buildErrorLog(error, req));
            res.status(500).json({
                success: false,
                message: '소셜 링크를 가져오는데 실패했습니다.'
            });
        }
    }
);

router.post('/social-links',
    authenticateToken,
    requirePermission('social_links.create'),
    logActivity('create_social_link'),
    async (req, res) => {
        try {
            const body = getSocialLinkPayload(req);
            const validationError = validateCreateSocialLinkPayload(body);
            if (validationError) {
                return res.status(400).json({
                    success: false,
                    message: validationError
                });
            }

            const id = await SocialLinks.create(body);
            const link = await SocialLinks.getById(id);
            CacheUtils.invalidateResources('social_links');
            res.status(201).json({
                success: true,
                message: '소셜 링크가 생성되었습니다.',
                data: link
            });
        } catch (error) {
            logger.error('소셜 링크 생성 실패', buildErrorLog(error, req));
            res.status(500).json({
                success: false,
                message: '소셜 링크 생성에 실패했습니다.'
            });
        }
    }
);

module.exports = router;
export {};
