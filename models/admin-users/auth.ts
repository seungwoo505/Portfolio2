const {
    bcrypt,
    crypto,
    createQueryContext,
    defaultQueryContext,
    executeQuery,
    executeQuerySingle,
    executeTransaction,
    logger
} = require('./common');
const { getPasswordByteLimitError } = require('../../utils/admin-validation');

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

        const isValidPassword = typeof password === 'string'
            && !getPasswordByteLimitError(password)
            && await bcrypt.compare(password, user.password_hash);

        if (!isValidPassword) {
            logger.security('로그인 실패 - 잘못된 비밀번호', {
                username: user.username,
                failedAttempts: user.failed_login_attempts + 1,
                ipAddress
            });
            await this.incrementFailedAttempts(user.id);
            throw new Error('비밀번호가 올바르지 않습니다.');
        }

        const result = await executeTransaction(async (connection) => {
            const db = createQueryContext(connection);
            // 비밀번호 교체와 세션 발급이 같은 사용자 행 잠금을 사용한다.
            const currentUser = await db.querySingle(`
                SELECT * FROM admin_users WHERE id = ? FOR UPDATE
            `, [user.id]);

            if (!currentUser || !currentUser.is_active) {
                throw new Error('사용자를 찾을 수 없습니다.');
            }
            if (currentUser.locked_until && new Date(currentUser.locked_until) > new Date()) {
                throw new Error('계정이 일시적으로 잠겨있습니다.');
            }
            if (currentUser.password_hash !== user.password_hash) {
                throw new Error('비밀번호가 올바르지 않습니다.');
            }

            await this.handleSuccessfulLogin(currentUser.id, ipAddress, db);

            const sessionId = crypto.randomUUID();
            const token = this.generateToken(currentUser, ipAddress, sessionId);
            const refreshToken = this.generateRefreshToken(currentUser, ipAddress, sessionId);

            await this.createSession({
                sessionId,
                adminId: currentUser.id,
                refreshToken,
                ipAddress,
                userAgent
            }, db);

            return {
                user: this.sanitizeUser(currentUser),
                token,
                refreshToken
            };
        });

        logger.auth('로그인 성공', result.user, { ipAddress });

        return result;
    },

    /**
     * @description 관리자 사용자의 로그인 실패 횟수를 증가시킨다.
     * @param {*} id 입력값
     * @returns {Promise<any>} 처리 결과
     */
    async incrementFailedAttempts(id) {
        // 단일 테이블 UPDATE의 CASE는 앞에서 증가한 실패 횟수로 평가된다.
        await executeQuery(`
            UPDATE admin_users
            SET failed_login_attempts = failed_login_attempts + 1,
                locked_until = CASE
                    WHEN failed_login_attempts >= 5 THEN DATE_ADD(NOW(), INTERVAL 30 MINUTE)
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
    async handleSuccessfulLogin(id, ipAddress, db = defaultQueryContext) {
        await db.query(`
            UPDATE admin_users
            SET failed_login_attempts = 0,
                locked_until = NULL,
                last_login_at = NOW(),
                last_login_ip = ?
            WHERE id = ?
        `, [ipAddress, id]);
    }
};
export {};
