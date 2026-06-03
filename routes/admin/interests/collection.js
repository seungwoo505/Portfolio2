const express = require('express');
const { logger, buildErrorLog } = require('../common');
const Interests = require('../../../models/interests');
const CacheUtils = require('../../../utils/cache');
const { toStringValue } = require('../../../utils/filter-values');
const { authenticateToken, requirePermission, logActivity } = require('../../../middleware/auth');
const {
    getInterestPayload,
    validateCreateInterestPayload
} = require('./payload');

const router = express.Router();

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
            const body = getInterestPayload(req);
            const validationError = validateCreateInterestPayload(body);
            if (validationError) {
                return res.status(400).json({
                    success: false,
                    message: validationError
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

module.exports = router;
