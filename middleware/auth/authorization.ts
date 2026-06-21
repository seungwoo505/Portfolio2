import type { Request, RequestHandler } from 'express';

const {
    AdminUsers,
    logger
} = require('./common');

type AdminRoleInput = string | string[];

const getErrorMessage = (error: unknown): string => (
    error instanceof Error ? error.message : String(error)
);

const getErrorStack = (error: unknown): string | undefined => (
    error instanceof Error ? error.stack : undefined
);

const getClientIp = (req: Request): string | undefined => req.ip || req.connection.remoteAddress;

/**
 * @description 특정 권한이 있는지 검사한다.
 * @param {*} permissionName 입력값
 * @returns {any} 처리 결과
 */
const requirePermission = (permissionName: string): RequestHandler => {
    return async (req, res, next) => {
        try {
            if (!req.admin) {
                return res.status(401).json({
                    success: false,
                    message: '인증이 필요합니다.'
                });
            }

            if (req.admin.role === 'super_admin') {
                return next();
            }

            const hasPermission = await AdminUsers.hasPermission(req.admin.id, permissionName);

            if (!hasPermission) {
                logger.warn('권한 인가 실패', {
                    requestId: req.requestId,
                    adminId: req.admin.id,
                    permission: permissionName
                });

                return res.status(403).json({
                    success: false,
                    message: '권한이 부족합니다.'
                });
            }

            next();
        } catch (error) {
            logger.error('권한 확인 실패', {
                requestId: req.requestId,
                adminId: req.admin?.id,
                permission: permissionName,
                error: getErrorMessage(error),
                stack: getErrorStack(error)
            });

            return res.status(500).json({
                success: false,
                message: '권한 확인 중 오류가 발생했습니다.'
            });
        }
    };
};

/**
 * @description 특정 역할이 있는지 검사한다.
 * @param {*} roles 입력값
 * @returns {any} 처리 결과
 */
const requireRole = (roles: AdminRoleInput): RequestHandler => {
    return (req, res, next) => {
        if (!req.admin) {
            return res.status(401).json({
                success: false,
                message: '인증이 필요합니다.'
            });
        }

        const allowedRoles = Array.isArray(roles) ? roles : [roles];

        if (!req.admin.role || !allowedRoles.includes(req.admin.role)) {
            logger.warn('역할 인가 실패', {
                requestId: req.requestId,
                adminId: req.admin.id,
                currentRole: req.admin.role,
                requiredRoles: allowedRoles
            });

            return res.status(403).json({
                success: false,
                message: '접근 권한이 부족합니다.'
            });
        }

        next();
    };
};

/**
 * @description 인증을 지정된 IP로 제한한다.
 * @param {*} allowedIPs 입력값
 * @returns {any} 처리 결과
 */
const restrictToIPs = (allowedIPs: string[]): RequestHandler => {
    return (req, res, next) => {
        const clientIP = getClientIp(req);

        if (!clientIP || !allowedIPs.includes(clientIP)) {
            logger.warn('IP 접근 차단', {
                requestId: req.requestId,
                ip: clientIP
            });

            return res.status(403).json({
                success: false,
                message: '허용되지 않은 IP 주소입니다.'
            });
        }

        next();
    };
};

module.exports = {
    requirePermission,
    requireRole,
    restrictToIPs
};
