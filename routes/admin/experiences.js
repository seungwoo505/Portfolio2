const express = require('express');
const router = express.Router();
const { logger, buildErrorLog } = require('./common');
const Experiences = require('../../models/experiences');
const CacheUtils = require('../../utils/cache');
const { authenticateToken, requirePermission, logActivity } = require('../../middleware/auth');

router.get('/experiences',
    authenticateToken,
    requirePermission('experiences.read'),
    async (req, res) => {
        try {
            const { type } = req.query;
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

router.get('/experiences/timeline',
    authenticateToken,
    requirePermission('experiences.read'),
    async (req, res) => {
        try {
            const timeline = await Experiences.getTimeline();
            res.json({
                success: true,
                data: timeline
            });
        } catch (error) {
            logger.error('관리자 타임라인 조회 실패', buildErrorLog(error, req));
            res.status(500).json({
                success: false,
                message: '타임라인 정보를 가져오는데 실패했습니다.'
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
            const { type, title } = req.body;

            if (!type || !title) {
                return res.status(400).json({
                    success: false,
                    message: '타입과 제목은 필수입니다.'
                });
            }

            const mappedData = {
                ...req.body,
                company_or_institution: req.body.company || req.body.company_or_institution
            };

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

router.put('/experiences/:id',
    authenticateToken,
    requirePermission('experiences.update'),
    logActivity('update_experience'),
    async (req, res) => {
        try {
            const { id } = req.params;
            const { type, title } = req.body;

            if (!type || !title) {
                return res.status(400).json({
                    success: false,
                    message: '타입과 제목은 필수입니다.'
                });
            }

            const mappedData = {
                ...req.body,
                company_or_institution: req.body.company || req.body.company_or_institution
            };

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
            const { id } = req.params;
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
