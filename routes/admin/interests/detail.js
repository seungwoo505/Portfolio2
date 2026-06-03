const express = require('express');
const { logger, buildErrorLog } = require('../common');
const Interests = require('../../../models/interests');
const CacheUtils = require('../../../utils/cache');
const { parsePositiveIntegerParam } = require('../../../utils/route-params');
const { authenticateToken, requirePermission, logActivity } = require('../../../middleware/auth');
const {
    getInterestPayload,
    validateUpdateInterestPayload
} = require('./payload');

const router = express.Router();

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

            const body = getInterestPayload(req);
            const validationError = validateUpdateInterestPayload(body);
            if (validationError) {
                return res.status(400).json({
                    success: false,
                    message: validationError
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
