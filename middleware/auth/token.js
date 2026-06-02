const {
    AdminUsers,
    logger
} = require('./common');

/**
 * @description 인증 토큰을 검증한다.
 * @param {*} req 입력값
 * @param {*} res 입력값
 * @param {*} next 입력값
 * @returns {Promise<any>} 처리 결과
 */
const authenticateToken = async (req, res, next) => {
    try {
        const authHeader = req.headers['authorization'];
        const token = authHeader && authHeader.split(' ')[1];
        const refreshToken = req.headers['x-refresh-token'];

        if (!token) {
            return res.status(401).json({
                success: false,
                message: '인증 토큰이 필요합니다.'
            });
        }

        try {
            const decoded = AdminUsers.verifyToken(token);

            const clientIP = req.ip || req.connection.remoteAddress;
            if (decoded.ip && decoded.ip !== clientIP) {
                return res.status(401).json({
                    success: false,
                    message: '토큰이 다른 IP에서 발급되었습니다.'
                });
            }

            const user = await AdminUsers.getById(decoded.id);
            if (!user || !user.is_active) {
                return res.status(401).json({
                    success: false,
                    message: '비활성화된 사용자입니다.'
                });
            }

            await AdminUsers.assertActiveSession(decoded.sid, decoded.id);

            req.admin = {
                id: decoded.id,
                username: decoded.username,
                role: decoded.role,
                sessionId: decoded.sid
            };

            next();
        } catch (tokenError) {
            if (refreshToken) {
                try {
                    const refreshDecoded = AdminUsers.verifyRefreshToken(refreshToken);

                    const clientIP = req.ip || req.connection.remoteAddress;
                    if (refreshDecoded.ip && refreshDecoded.ip !== clientIP) {
                        return res.status(401).json({
                            success: false,
                            message: 'Refresh Token이 다른 IP에서 발급되었습니다.'
                        });
                    }

                    const user = await AdminUsers.getById(refreshDecoded.id);
                    if (!user || !user.is_active) {
                        return res.status(401).json({
                            success: false,
                            message: '비활성화된 사용자입니다.'
                        });
                    }

                    const newRefreshToken = await AdminUsers.rotateRefreshSession(refreshToken, refreshDecoded, user, clientIP);
                    const newToken = AdminUsers.generateToken(user, clientIP, refreshDecoded.sid);

                    req.admin = {
                        id: user.id,
                        username: user.username,
                        role: user.role,
                        sessionId: refreshDecoded.sid
                    };

                    res.setHeader('X-New-Token', newToken);
                    res.setHeader('X-New-Refresh-Token', newRefreshToken);

                    logger.info('토큰 자동 재발급 성공', {
                        userId: user.id,
                        username: user.username,
                        ip: clientIP
                    });

                    next();
                } catch (refreshError) {
                    logger.warn('토큰 재발급 실패', {
                        error: refreshError.message,
                        ip: req.ip || req.connection.remoteAddress
                    });

                    return res.status(401).json({
                        success: false,
                        message: '토큰이 만료되었습니다. 다시 로그인해주세요.'
                    });
                }
            } else {
                return res.status(401).json({
                    success: false,
                    message: '토큰이 만료되었습니다. 다시 로그인해주세요.'
                });
            }
        }
    } catch (error) {
        logger.error('인증 미들웨어 오류', { error: error.message });
        return res.status(500).json({
            success: false,
            message: '인증 처리 중 오류가 발생했습니다.'
        });
    }
};

module.exports = {
    authenticateToken
};
