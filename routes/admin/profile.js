const express = require('express');
const router = express.Router();
const { logger, buildErrorLog } = require('./common');
const PersonalInfo = require('../../models/personal-info');
const SocialLinks = require('../../models/social-links');
const CacheUtils = require('../../utils/cache');
const { parsePositiveIntegerParam } = require('../../utils/route-params');
const {
    getPlainBody,
    hasInvalidProvidedStringFields,
    hasRequiredStringFields,
    trimStringFields
} = require('../../utils/request-body');
const { authenticateToken, requirePermission, logActivity } = require('../../middleware/auth');

router.get('/personal-info',
    authenticateToken,
    requirePermission('personal_info.read'),
    async (req, res) => {
        try {
            const profile = await PersonalInfo.get();
            res.json({ success: true, data: profile });
        } catch (error) {
            logger.error('개인 정보 조회 실패', buildErrorLog(error, req));
            res.status(500).json({
                success: false,
                message: '개인 정보를 가져오는데 실패했습니다.'
            });
        }
    }
);

router.put('/personal-info',
    authenticateToken,
    requirePermission('personal_info.update'),
    logActivity('update_personal_info'),
    async (req, res) => {
        try {
            const body = getPlainBody(req);

            if (Object.keys(body).length === 0) {
                return res.status(400).json({
                    success: false,
                    message: '수정할 개인 정보가 필요합니다.'
                });
            }

            const profile = await PersonalInfo.update(body);
            CacheUtils.invalidateResources('personal_info');
            res.json({
                success: true,
                message: '개인 정보가 업데이트되었습니다.',
                data: profile
            });
        } catch (error) {
            logger.error('개인 정보 수정 실패', buildErrorLog(error, req));
            res.status(500).json({
                success: false,
                message: '개인 정보 수정에 실패했습니다.'
            });
        }
    }
);

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
            const body = trimStringFields(getPlainBody(req), ['platform', 'url']);
            if (!hasRequiredStringFields(body, ['platform', 'url'])) {
                return res.status(400).json({
                    success: false,
                    message: '플랫폼과 URL은 필수입니다.'
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

            const body = trimStringFields(getPlainBody(req), ['platform', 'url']);

            if (Object.keys(body).length === 0) {
                return res.status(400).json({
                    success: false,
                    message: '수정할 소셜 링크 정보가 필요합니다.'
                });
            }

            if (hasInvalidProvidedStringFields(body, ['platform', 'url'])) {
                return res.status(400).json({
                    success: false,
                    message: '플랫폼과 URL은 비어 있을 수 없습니다.'
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
