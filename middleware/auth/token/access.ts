import type { Request } from 'express';

const { AdminUsers } = require('../common');
const {
    buildAdminContext,
    getClientIp
} = require('./context');

type AuthFailure = {
    error: {
        statusCode: number;
        message: string;
    };
};

const authenticateAccessToken = async (req: Request, token: string) => {
    const decoded = AdminUsers.verifyToken(token);
    const clientIP = getClientIp(req);

    if (decoded.ip && decoded.ip !== clientIP) {
        return {
            error: {
                statusCode: 401,
                message: '토큰이 다른 IP에서 발급되었습니다.'
            }
        } satisfies AuthFailure;
    }

    const user = await AdminUsers.getById(decoded.id);
    if (!user || !user.is_active) {
        return {
            error: {
                statusCode: 401,
                message: '비활성화된 사용자입니다.'
            }
        } satisfies AuthFailure;
    }

    await AdminUsers.assertActiveSession(decoded.sid, decoded.id);

    return {
        admin: buildAdminContext({ decoded })
    };
};

module.exports = {
    authenticateAccessToken
};

export {};
