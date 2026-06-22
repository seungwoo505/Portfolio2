const {
    crypto,
    jwt
} = require('./common');

module.exports = {
    /**
     * @description 관리자 사용자 모델의 액세스 토큰을 생성한다.
     * @param {*} user 입력값
     * @param {*} ipAddress 입력값
     * @returns {any} 처리 결과
     */
    generateToken(user, ipAddress, sessionId) {
        return jwt.sign(
            {
                id: user.id,
                username: user.username,
                role: user.role,
                sid: sessionId,
                ip: ipAddress,
                iat: Math.floor(Date.now() / 1000)
            },
            process.env.JWT_SECRET,
            { expiresIn: '30m' }
        );
    },

    /**
     * @description 관리자 사용자 모델의 리프레시 토큰을 생성한다.
     * @param {*} user 입력값
     * @param {*} ipAddress 입력값
     * @returns {any} 처리 결과
     */
    generateRefreshToken(user, ipAddress, sessionId) {
        return jwt.sign(
            {
                id: user.id,
                username: user.username,
                type: 'refresh',
                sid: sessionId,
                ip: ipAddress,
                jti: crypto.randomUUID(),
                iat: Math.floor(Date.now() / 1000)
            },
            process.env.JWT_REFRESH_SECRET || process.env.JWT_SECRET,
            { expiresIn: '12h' }
        );
    },

    /**
     * @description 관리자 사용자 모델에서 액세스 토큰을 검증한다.
     * @param {*} token 입력값
     * @returns {any} 처리 결과
     */
    verifyToken(token) {
        try {
            const decoded = jwt.verify(token, process.env.JWT_SECRET);
            if (decoded.type === 'refresh') {
                throw new Error('잘못된 토큰 타입입니다.');
            }
            return decoded;
        } catch (error) {
            throw new Error('유효하지 않은 토큰입니다.');
        }
    },

    /**
     * @description 관리자 사용자 모델에서 리프레시 토큰을 검증한다.
     * @param {*} token 입력값
     * @returns {any} 처리 결과
     */
    verifyRefreshToken(token) {
        try {
            const decoded = jwt.verify(token, process.env.JWT_REFRESH_SECRET || process.env.JWT_SECRET);
            if (decoded.type !== 'refresh') {
                throw new Error('잘못된 토큰 타입입니다.');
            }
            return decoded;
        } catch (error) {
            throw new Error('유효하지 않은 Refresh Token입니다.');
        }
    },

    /**
     * @description 관리자 리프레시 토큰 저장용 해시를 생성한다.
     * @param {*} token 입력값
     * @returns {string} 처리 결과
     */
    hashToken(token) {
        return crypto.createHash('sha256').update(token).digest('hex');
    },

    /**
     * @description 관리자 세션 만료 시각을 계산한다.
     * @returns {Date} 처리 결과
     */
    getRefreshTokenExpiresAt() {
        return new Date(Date.now() + 12 * 60 * 60 * 1000);
    }
};
export {};
