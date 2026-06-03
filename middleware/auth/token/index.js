const { logger } = require('../common');
const { authenticateAccessToken } = require('./access');
const { extractAuthTokens, getClientIp } = require('./context');
const { refreshAccessToken } = require('./refresh');

const sendAuthError = (res, { statusCode, message }) => (
    res.status(statusCode).json({
        success: false,
        message
    })
);

const sendExpiredTokenError = (res) => sendAuthError(res, {
    statusCode: 401,
    message: '토큰이 만료되었습니다. 다시 로그인해주세요.'
});

/**
 * @description 인증 토큰을 검증한다.
 * @param {*} req 입력값
 * @param {*} res 입력값
 * @param {*} next 입력값
 * @returns {Promise<any>} 처리 결과
 */
const authenticateToken = async (req, res, next) => {
    try {
        const { token, refreshToken } = extractAuthTokens(req);

        if (!token) {
            return sendAuthError(res, {
                statusCode: 401,
                message: '인증 토큰이 필요합니다.'
            });
        }

        try {
            const result = await authenticateAccessToken(req, token);
            if (result.error) {
                return sendAuthError(res, result.error);
            }

            req.admin = result.admin;
            return next();
        } catch (tokenError) {
            if (!refreshToken) {
                return sendExpiredTokenError(res);
            }

            try {
                const result = await refreshAccessToken(req, res, refreshToken);
                if (result.error) {
                    return sendAuthError(res, result.error);
                }

                req.admin = result.admin;
                return next();
            } catch (refreshError) {
                logger.warn('토큰 재발급 실패', {
                    error: refreshError.message,
                    ip: getClientIp(req)
                });

                return sendExpiredTokenError(res);
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
