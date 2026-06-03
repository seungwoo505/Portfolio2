const { AdminUsers } = require('../common');
const {
    buildAdminContext,
    getClientIp
} = require('./context');

const authenticateAccessToken = async (req, token) => {
    const decoded = AdminUsers.verifyToken(token);
    const clientIP = getClientIp(req);

    if (decoded.ip && decoded.ip !== clientIP) {
        return {
            error: {
                statusCode: 401,
                message: '토큰이 다른 IP에서 발급되었습니다.'
            }
        };
    }

    const user = await AdminUsers.getById(decoded.id);
    if (!user || !user.is_active) {
        return {
            error: {
                statusCode: 401,
                message: '비활성화된 사용자입니다.'
            }
        };
    }

    await AdminUsers.assertActiveSession(decoded.sid, decoded.id);

    return {
        admin: buildAdminContext({ decoded })
    };
};

module.exports = {
    authenticateAccessToken
};
