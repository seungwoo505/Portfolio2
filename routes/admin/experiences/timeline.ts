const express = require('express');
const { logger, buildErrorLog } = require('../common');
const Experiences = require('../../../models/experiences');
const { authenticateToken, requirePermission } = require('../../../middleware/auth');

const router = express.Router();

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

module.exports = router;
export {};
