const express = require('express');
const router = express.Router();
const { logger, buildErrorLog } = require('./common');
const Interests = require('../../models/interests');
const CacheUtils = require('../../utils/cache');
const { toStringValue } = require('../../utils/filter-values');
const { parsePositiveIntegerParam } = require('../../utils/route-params');
const {
    getPlainBody,
    hasInvalidProvidedStringFields,
    hasRequiredStringFields,
    trimStringFields
} = require('../../utils/request-body');
const { authenticateToken, requirePermission, logActivity } = require('../../middleware/auth');

const interestStringFields = ['title', 'description', 'icon', 'category'];

router.get('/interests',
    authenticateToken,
    requirePermission('interests.read'),
    async (req, res) => {
        try {
            const category = toStringValue(req.query.category).trim() || null;
            const interests = category
                ? await Interests.getByCategory(category)
                : await Interests.getAll();

            res.json({
                success: true,
                data: interests
            });
        } catch (error) {
            logger.error('관리자 관심사 목록 조회 실패', buildErrorLog(error, req));
            res.status(500).json({
                success: false,
                message: '관심사 정보를 가져오는데 실패했습니다.'
            });
        }
    }
);

router.post('/interests',
    authenticateToken,
    requirePermission('interests.create'),
    logActivity('create_interest'),
    async (req, res) => {
        try {
            const body = trimStringFields(getPlainBody(req), interestStringFields);

            if (!hasRequiredStringFields(body, ['title', 'category'])) {
                return res.status(400).json({
                    success: false,
                    message: '제목과 카테고리는 필수입니다.'
                });
            }

            const interest = await Interests.create(body);
            CacheUtils.invalidateResources('interests');

            res.status(201).json({
                success: true,
                message: '관심사가 생성되었습니다.',
                data: interest
            });
        } catch (error) {
            logger.error('관리자 관심사 생성 실패', buildErrorLog(error, req));
            res.status(500).json({
                success: false,
                message: '관심사 생성에 실패했습니다.'
            });
        }
    }
);

router.put('/interests/:id',
    authenticateToken,
    requirePermission('interests.update'),
    logActivity('update_interest'),
    async (req, res) => {
        try {
            const id = parsePositiveIntegerParam(req.params.id);
            if (!id) {
                return res.status(400).json({
                    success: false,
                    message: '유효한 관심사 ID가 필요합니다.'
                });
            }

            const body = trimStringFields(getPlainBody(req), interestStringFields);

            if (Object.keys(body).length === 0) {
                return res.status(400).json({
                    success: false,
                    message: '수정할 관심사 정보가 필요합니다.'
                });
            }

            if (hasInvalidProvidedStringFields(body, ['title', 'category'])) {
                return res.status(400).json({
                    success: false,
                    message: '제목과 카테고리는 비어 있을 수 없습니다.'
                });
            }

            const existingInterest = await Interests.getById(id);
            if (!existingInterest) {
                return res.status(404).json({
                    success: false,
                    message: '관심사를 찾을 수 없습니다.'
                });
            }

            const interest = await Interests.update(id, body);
            CacheUtils.invalidateResources('interests');

            res.json({
                success: true,
                message: '관심사가 수정되었습니다.',
                data: interest
            });
        } catch (error) {
            logger.error('관리자 관심사 수정 실패', buildErrorLog(error, req));
            res.status(500).json({
                success: false,
                message: '관심사 수정에 실패했습니다.'
            });
        }
    }
);

router.delete('/interests/:id',
    authenticateToken,
    requirePermission('interests.delete'),
    logActivity('delete_interest'),
    async (req, res) => {
        try {
            const id = parsePositiveIntegerParam(req.params.id);
            if (!id) {
                return res.status(400).json({
                    success: false,
                    message: '유효한 관심사 ID가 필요합니다.'
                });
            }

            const existingInterest = await Interests.getById(id);
            if (!existingInterest) {
                return res.status(404).json({
                    success: false,
                    message: '관심사를 찾을 수 없습니다.'
                });
            }

            await Interests.delete(id);
            CacheUtils.invalidateResources('interests');

            res.json({
                success: true,
                message: '관심사가 삭제되었습니다.'
            });
        } catch (error) {
            logger.error('관리자 관심사 삭제 실패', buildErrorLog(error, req));
            res.status(500).json({
                success: false,
                message: '관심사 삭제에 실패했습니다.'
            });
        }
    }
);

module.exports = router;
