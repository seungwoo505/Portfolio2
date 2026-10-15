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
        let recorded = false;
        let jsonResponseSent = false;
        const recordSuccess = (data?: unknown) => {
            if (recorded || !req.admin) {
                return;
            }
            recorded = true;

            const resourceType = inferResourceType(req);
            const resourceId = getResourceId(req, data);

            setImmediate(async () => {
                try {
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
        };

        const originalJson = res.json;
        res.json = function jsonWithActivity(body: unknown) {
            const responseEnded = this.headersSent || this.writableEnded || this.destroyed;
            if (!responseEnded) jsonResponseSent = true;
            if (
                body !== null && typeof body === 'object' && 'success' in body && body.success === true
                && (this.statusCode < 400 || responseEnded)
            ) {
                // 타임아웃 응답 뒤 완료된 변경도 실제 성공 결과를 기준으로 한 번 기록한다.
                recordSuccess('data' in body ? body.data : undefined);
            }
            if (responseEnded) return this;
            return originalJson.call(this, body);
        };

        res.once('finish', () => {
            // JSON 외의 성공 응답도 지원한다. JSON 경로와는 중복 기록하지 않는다.
            if (!jsonResponseSent && res.statusCode < 400) recordSuccess();
        });

        next();
    };
};

module.exports = {
    logActivity
};
