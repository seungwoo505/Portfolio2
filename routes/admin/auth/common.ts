import type { Request } from 'express';

const { logger, buildErrorLog } = require('../common');
const AdminUsers = require('../../../models/admin-users');
const AdminActivityLogs = require('../../../models/admin-activity-logs');
const { authenticateToken, logActivity } = require('../../../middleware/auth');
const { getPlainBody, hasRequiredStringFields, trimStringFields } = require('../../../utils/request-body');
const { getPasswordPolicyError } = require('../../../utils/admin-validation');

const genericLoginFailureMessage = '사용자명 또는 비밀번호가 올바르지 않습니다.';
const genericRefreshFailureMessage = 'Refresh Token이 유효하지 않거나 만료되었습니다.';
const passwordChangeClientErrors = new Set([
    '사용자를 찾을 수 없습니다.',
    '기존 비밀번호가 올바르지 않습니다.'
]);

type AuthActivityOptions = {
    adminId?: number | null;
    action: string;
    details: string;
};

const logAuthActivitySafe = async (req: Request, {
    adminId = null,
    action,
    details
}: AuthActivityOptions): Promise<void> => {
    try {
        await AdminActivityLogs.log(
            adminId,
            action,
            'auth',
            null,
            details,
            req.ip,
            req.headers['user-agent']
        );
    } catch (error) {
        logger.warn('인증 활동 로그 기록 실패', buildErrorLog(error, req, {
            action,
            adminId
        }));
    }
};

module.exports = {
    AdminActivityLogs,
    AdminUsers,
    authenticateToken,
    buildErrorLog,
    genericLoginFailureMessage,
    genericRefreshFailureMessage,
    getPasswordPolicyError,
    getPlainBody,
    hasRequiredStringFields,
    logActivity,
    logAuthActivitySafe,
    logger,
    passwordChangeClientErrors,
    trimStringFields
};
