import type { RequestHandler } from 'express';

const {
    AdminActivityLogs,
    logger
} = require('./common');
const { buildActivityDetails } = require('./activity/details');
const {
    getClientIp,
    getResourceId,
    inferResourceType,
    summarizeUserAgent
} = require('./activity/request');

const getErrorMessage = (error: unknown): string => (
    error instanceof Error ? error.message : String(error)
);

const getErrorStack = (error: unknown): string | undefined => (
    error instanceof Error ? error.stack : undefined
);

/**
 * @description 성공한 관리자 변경 작업을 DB 감사 로그에 기록한다.
 * @param {string} action 액션 코드
 * @returns {Function} Express 미들웨어
 */
const logActivity = (action: string): RequestHandler => {
    return (req, res, next) => {
        res.on('finish', () => {
            if (res.statusCode >= 400 || !req.admin) {
                return;
            }

            setImmediate(async () => {
                try {
                    const resourceType = inferResourceType(req);
                    const resourceId = getResourceId(req);
                    const details = buildActivityDetails(action, req, resourceType, resourceId);

                    await AdminActivityLogs.log(
                        req.admin.id,
                        action,
                        resourceType,
                        resourceId,
                        details,
                        getClientIp(req),
                        summarizeUserAgent(req.headers['user-agent'])
                    );
                } catch (error) {
                    logger.error('활동 로그 기록 실패', {
                        requestId: req.requestId,
                        action,
                        error: getErrorMessage(error),
                        stack: getErrorStack(error)
                    });
                }
            });
        });

        next();
    };
};

module.exports = {
    logActivity
};
