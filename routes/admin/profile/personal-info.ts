const express = require('express');
const { logger, buildErrorLog } = require('../common');
const PersonalInfo = require('../../../models/personal-info');
const CacheUtils = require('../../../utils/cache');
const { getPlainBody } = require('../../../utils/request-body');
const { authenticateToken, requirePermission, logActivity } = require('../../../middleware/auth');

const router = express.Router();

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

module.exports = router;
export {};
