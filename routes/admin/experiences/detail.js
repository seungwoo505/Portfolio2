const express = require('express');
const { logger, buildErrorLog } = require('../common');
const Experiences = require('../../../models/experiences');
const CacheUtils = require('../../../utils/cache');
const { parsePositiveIntegerParam } = require('../../../utils/route-params');
const { authenticateToken, requirePermission, logActivity } = require('../../../middleware/auth');
const {
    getExperiencePayload,
    mapExperienceBody,
    validateRequiredExperiencePayload
} = require('./payload');

const router = express.Router();

router.put('/experiences/:id',
    authenticateToken,
    requirePermission('experiences.update'),
    logActivity('update_experience'),
    async (req, res) => {
        try {
            const id = parsePositiveIntegerParam(req.params.id);
            if (!id) {
                return res.status(400).json({
                    success: false,
                    message: '유효한 경력 ID가 필요합니다.'
                });
            }

            const body = getExperiencePayload(req);
            const validationError = validateRequiredExperiencePayload(body);
            if (validationError) {
                return res.status(400).json({
                    success: false,
                    message: validationError
                });
            }

            const existingExperience = await Experiences.getById(id);
            if (!existingExperience) {
                return res.status(404).json({
                    success: false,
                    message: '경력을 찾을 수 없습니다.'
                });
            }

            const mappedData = mapExperienceBody(body);
            const updatedExperience = await Experiences.update(id, mappedData);
            CacheUtils.invalidateResources('experiences');

            res.json({
                success: true,
                message: '경력이 수정되었습니다.',
                data: updatedExperience
            });
        } catch (error) {
            logger.error('관리자 경력 수정 실패', buildErrorLog(error, req));
            res.status(500).json({
                success: false,
                message: '경력 수정에 실패했습니다.'
            });
        }
    }
);

router.delete('/experiences/:id',
    authenticateToken,
    requirePermission('experiences.delete'),
    logActivity('delete_experience'),
    async (req, res) => {
        try {
            const id = parsePositiveIntegerParam(req.params.id);
            if (!id) {
                return res.status(400).json({
                    success: false,
                    message: '유효한 경력 ID가 필요합니다.'
                });
            }

            const existingExperience = await Experiences.getById(id);
            if (!existingExperience) {
                return res.status(404).json({
                    success: false,
                    message: '경력을 찾을 수 없습니다.'
                });
            }

            await Experiences.delete(id);
            CacheUtils.invalidateResources('experiences');

            res.json({
                success: true,
                message: '경력이 삭제되었습니다.'
            });
        } catch (error) {
            logger.error('관리자 경력 삭제 실패', buildErrorLog(error, req));
            res.status(500).json({
                success: false,
                message: '경력 삭제에 실패했습니다.'
            });
        }
    }
);

module.exports = router;
