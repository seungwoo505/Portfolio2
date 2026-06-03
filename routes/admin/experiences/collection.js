const express = require('express');
const { logger, buildErrorLog } = require('../common');
const Experiences = require('../../../models/experiences');
const CacheUtils = require('../../../utils/cache');
const { toStringValue } = require('../../../utils/filter-values');
const { authenticateToken, requirePermission, logActivity } = require('../../../middleware/auth');
const {
    getExperiencePayload,
    mapExperienceBody,
    validateRequiredExperiencePayload
} = require('./payload');

const router = express.Router();

router.get('/experiences',
    authenticateToken,
    requirePermission('experiences.read'),
    async (req, res) => {
        try {
            const type = toStringValue(req.query.type).trim() || null;
            const experiences = type
                ? await Experiences.getByType(type)
                : await Experiences.getAll();

            res.json({
                success: true,
                data: experiences
            });
        } catch (error) {
            logger.error('관리자 경력 목록 조회 실패', buildErrorLog(error, req));
            res.status(500).json({
                success: false,
                message: '경력 정보를 가져오는데 실패했습니다.'
            });
        }
    }
);

router.post('/experiences',
    authenticateToken,
    requirePermission('experiences.create'),
    logActivity('create_experience'),
    async (req, res) => {
        try {
            const body = getExperiencePayload(req);
            const validationError = validateRequiredExperiencePayload(body);
            if (validationError) {
                return res.status(400).json({
                    success: false,
                    message: validationError
                });
            }

            const mappedData = mapExperienceBody(body);
            const id = await Experiences.create(mappedData);
            const newExperience = await Experiences.getById(id);
            CacheUtils.invalidateResources('experiences');

            res.status(201).json({
                success: true,
                message: '경력이 추가되었습니다.',
                data: newExperience
            });
        } catch (error) {
            logger.error('관리자 경력 생성 실패', buildErrorLog(error, req));
            res.status(500).json({
                success: false,
                message: '경력 추가에 실패했습니다.'
            });
        }
    }
);

module.exports = router;
