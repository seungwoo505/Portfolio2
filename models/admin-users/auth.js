const {
    bcrypt,
    crypto,
    executeQuery,
    executeQuerySingle,
    logger
} = require('./common');

module.exports = {
    /**
     * @description 관리자 사용자 모델에서 로그인을 처리한다.
     * @param {*} username 입력값
     * @param {*} password 입력값
     * @param {*} ipAddress 입력값
     * @param {*} userAgent 입력값
     * @returns {Promise<any>} 처리 결과
     */
    async login(username, password, ipAddress, userAgent) {
        logger.auth('로그인 시도', null, { username, ipAddress, userAgent });

        const user = await executeQuerySingle(`
            SELECT * FROM admin_users
            WHERE (username = ? OR email = ?) AND is_active = TRUE
        `, [username, username]);

        if (!user) {
            logger.security('로그인 실패 - 사용자를 찾을 수 없음', { username, ipAddress });
            throw new Error('사용자를 찾을 수 없습니다.');
        }

        if (user.locked_until && new Date(user.locked_until) > new Date()) {
            logger.security('로그인 실패 - 계정 잠금', {
                username: user.username,
                lockedUntil: user.locked_until,
                ipAddress
            });
            throw new Error('계정이 일시적으로 잠겨있습니다.');
        }

        const isValidPassword = await bcrypt.compare(password, user.password_hash);

        if (!isValidPassword) {
            logger.security('로그인 실패 - 잘못된 비밀번호', {
                username: user.username,
                failedAttempts: user.failed_login_attempts + 1,
                ipAddress
            });
            await this.incrementFailedAttempts(user.id);
            throw new Error('비밀번호가 올바르지 않습니다.');
        }

        await this.handleSuccessfulLogin(user.id, ipAddress);

        const sessionId = crypto.randomUUID();
        const token = this.generateToken(user, ipAddress, sessionId);
        const refreshToken = this.generateRefreshToken(user, ipAddress, sessionId);

        await this.createSession({
            sessionId,
            adminId: user.id,
            refreshToken,
            ipAddress,
            userAgent
        });

        logger.auth('로그인 성공', this.sanitizeUser(user), { ipAddress });

        return {
            user: this.sanitizeUser(user),
            token,
            refreshToken
        };
    },

    /**
     * @description 관리자 사용자의 로그인 실패 횟수를 증가시킨다.
     * @param {*} id 입력값
     * @returns {Promise<any>} 처리 결과
     */
    async incrementFailedAttempts(id) {
        await executeQuery(`
            UPDATE admin_users
            SET failed_login_attempts = failed_login_attempts + 1,
                locked_until = CASE
                    WHEN failed_login_attempts >= 4 THEN DATE_ADD(NOW(), INTERVAL 30 MINUTE)
                    ELSE locked_until
                END
            WHERE id = ?
        `, [id]);
    },

    /**
     * @description 관리자 사용자가 성공적으로 로그인했을 때 후처리를 수행한다.
     * @param {*} id 입력값
     * @param {*} ipAddress 입력값
     * @returns {Promise<any>} 처리 결과
     */
    async handleSuccessfulLogin(id, ipAddress) {
        await executeQuery(`
            UPDATE admin_users
            SET failed_login_attempts = 0,
                locked_until = NULL,
                last_login_at = NOW(),
                last_login_ip = ?
            WHERE id = ?
        `, [ipAddress, id]);
    }
};
