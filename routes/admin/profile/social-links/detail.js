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
