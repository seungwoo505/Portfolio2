const {
    AdminUsers,
    logger
} = require('../common');
const {
    buildAdminContext,
    getClientIp
} = require('./context');

const refreshAccessToken = async (req, res, refreshToken) => {
    const refreshDecoded = AdminUsers.verifyRefreshToken(refreshToken);
    const clientIP = getClientIp(req);

    if (refreshDecoded.ip && refreshDecoded.ip !== clientIP) {
        return {
            error: {
                statusCode: 401,
                message: 'Refresh Token이 다른 IP에서 발급되었습니다.'
            }
        };
    }

    const user = await AdminUsers.getById(refreshDecoded.id);
    if (!user || !user.is_active) {
        return {
            error: {
                statusCode: 401,
                message: '비활성화된 사용자입니다.'
            }
        };
    }

    const newRefreshToken = await AdminUsers.rotateRefreshSession(
        refreshToken,
        refreshDecoded,
        user,
        clientIP
    );
    const newToken = AdminUsers.generateToken(user, clientIP, refreshDecoded.sid);

    res.setHeader('X-New-Token', newToken);
    res.setHeader('X-New-Refresh-Token', newRefreshToken);

    logger.info('토큰 자동 재발급 성공', {
        userId: user.id,
        username: user.username,
        ip: clientIP
    });

    return {
        admin: buildAdminContext({
            decoded: refreshDecoded,
            user
        })
    };
};

module.exports = {
    refreshAccessToken
};
