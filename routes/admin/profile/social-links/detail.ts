const express = require('express');
const { logger, buildErrorLog } = require('../../common');
const SocialLinks = require('../../../../models/social-links');
const CacheUtils = require('../../../../utils/cache');
const { parsePositiveIntegerParam } = require('../../../../utils/route-params');
const { authenticateToken, requirePermission, logActivity } = require('../../../../middleware/auth');
const {
    getSocialLinkPayload,
    validateUpdateSocialLinkPayload
} = require('./payload');

const router = express.Router();

/**
 * @swagger
 * /admin/social-links/{id}:
 *   put:
 *     summary: 소셜 링크 일부 수정
 *     tags:
 *       - Admin - Profile
 *     security:
 *       - bearerAuth: []
 *     description: '필요 권한: social_links.update.'
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         description: 대상의 양의 정수 ID
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
 *               is_active:
 *                 type: boolean
 *             minProperties: 1
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
 *       '404':
 *         description: 대상을 찾을 수 없음
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
 *   delete:
 *     summary: 소셜 링크 삭제
 *     tags:
 *       - Admin - Profile
 *     security:
 *       - bearerAuth: []
 *     description: '필요 권한: social_links.delete.'
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         description: 대상의 양의 정수 ID
 *         schema:
 *           type: integer
 *           minimum: 1
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
 *       '404':
 *         description: 대상을 찾을 수 없음
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
router.put('/social-links/:id',
    authenticateToken,
    requirePermission('social_links.update'),
    logActivity('update_social_link'),
    async (req, res) => {
        try {
            const linkId = parsePositiveIntegerParam(req.params.id);
            if (!linkId) {
                return res.status(400).json({
                    success: false,
                    message: '유효한 소셜 링크 ID가 필요합니다.'
                });
            }

            const body = getSocialLinkPayload(req);
            const validationError = validateUpdateSocialLinkPayload(body);
            if (validationError) {
                return res.status(400).json({
                    success: false,
                    message: validationError
                });
            }

            const existingLink = await SocialLinks.getById(linkId);
            if (!existingLink) {
                return res.status(404).json({
                    success: false,
                    message: '소셜 링크를 찾을 수 없습니다.'
                });
            }

            const link = await SocialLinks.update(linkId, body);
            CacheUtils.invalidateResources('social_links');
            res.json({
                success: true,
                message: '소셜 링크가 업데이트되었습니다.',
                data: link
            });
        } catch (error) {
            logger.error('소셜 링크 수정 실패', buildErrorLog(error, req));
            res.status(500).json({
                success: false,
                message: '소셜 링크 수정에 실패했습니다.'
            });
        }
    }
);

router.delete('/social-links/:id',
    authenticateToken,
    requirePermission('social_links.delete'),
    logActivity('delete_social_link'),
    async (req, res) => {
        try {
            const linkId = parsePositiveIntegerParam(req.params.id);
            if (!linkId) {
                return res.status(400).json({
                    success: false,
                    message: '유효한 소셜 링크 ID가 필요합니다.'
                });
            }

            const existingLink = await SocialLinks.getById(linkId);
            if (!existingLink) {
                return res.status(404).json({
                    success: false,
                    message: '소셜 링크를 찾을 수 없습니다.'
                });
            }

            await SocialLinks.delete(linkId);
            CacheUtils.invalidateResources('social_links');
            res.json({
                success: true,
                message: '소셜 링크가 삭제되었습니다.'
            });
        } catch (error) {
            logger.error('소셜 링크 삭제 실패', buildErrorLog(error, req));
            res.status(500).json({
                success: false,
                message: '소셜 링크 삭제에 실패했습니다.'
            });
        }
    }
);

module.exports = router;
export {};
