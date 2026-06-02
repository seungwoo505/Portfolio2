const {
    executeQuery,
    executeQuerySingle,
    logger,
    parseIntegerEnv
} = require('./common');

module.exports = {
    /**
     * @description 관리자 로그인 세션을 저장한다.
     * @param {*} session 입력값
     * @returns {Promise<any>} 처리 결과
     */
    async createSession(session) {
        const { sessionId, adminId, refreshToken, ipAddress, userAgent } = session;

        await executeQuery(`
            INSERT INTO admin_sessions (
                session_id, admin_id, refresh_token_hash, ip_address, user_agent, expires_at
            )
            VALUES (?, ?, ?, ?, ?, ?)
        `, [
            sessionId,
            adminId,
            this.hashToken(refreshToken),
            ipAddress,
            userAgent,
            this.getRefreshTokenExpiresAt()
        ]);
    },

    /**
     * @description 활성 관리자 세션을 조회한다.
     * @param {*} sessionId 입력값
     * @returns {Promise<any>} 처리 결과
     */
    async getActiveSession(sessionId) {
        if (!sessionId) {
            return null;
        }

        return await executeQuerySingle(`
            SELECT *
            FROM admin_sessions
            WHERE session_id = ?
                AND revoked_at IS NULL
                AND expires_at > NOW()
        `, [sessionId]);
    },

    /**
     * @description 토큰에 연결된 관리자 세션이 활성 상태인지 검증한다.
     * @param {*} sessionId 입력값
     * @param {*} adminId 입력값
     * @returns {Promise<any>} 처리 결과
     */
    async assertActiveSession(sessionId, adminId) {
        const session = await this.getActiveSession(sessionId);

        if (!session || Number(session.admin_id) !== Number(adminId)) {
            throw new Error('세션이 만료되었거나 로그아웃되었습니다.');
        }

        return session;
    },

    /**
     * @description 리프레시 토큰과 서버 저장 세션을 함께 검증한다.
     * @param {*} refreshToken 입력값
     * @param {*} decoded 입력값
     * @returns {Promise<any>} 처리 결과
     */
    async verifyRefreshSession(refreshToken, decoded) {
        const session = await this.assertActiveSession(decoded.sid, decoded.id);
        const tokenHash = this.hashToken(refreshToken);

        if (session.refresh_token_hash !== tokenHash) {
            throw new Error('Refresh Token 세션이 유효하지 않습니다.');
        }

        await executeQuery(`
            UPDATE admin_sessions
            SET last_used_at = NOW()
            WHERE session_id = ?
        `, [decoded.sid]);

        return session;
    },

    /**
     * @description 리프레시 토큰을 검증한 뒤 새 토큰으로 회전한다.
     * @param {*} refreshToken 입력값
     * @param {*} decoded 입력값
     * @param {*} user 입력값
     * @param {*} ipAddress 입력값
     * @returns {Promise<string>} 처리 결과
     */
    async rotateRefreshSession(refreshToken, decoded, user, ipAddress) {
        await this.verifyRefreshSession(refreshToken, decoded);

        const newRefreshToken = this.generateRefreshToken(user, ipAddress, decoded.sid);

        await executeQuery(`
            UPDATE admin_sessions
            SET refresh_token_hash = ?,
                expires_at = ?,
                last_used_at = NOW()
            WHERE session_id = ?
                AND revoked_at IS NULL
        `, [
            this.hashToken(newRefreshToken),
            this.getRefreshTokenExpiresAt(),
            decoded.sid
        ]);

        return newRefreshToken;
    },

    /**
     * @description 관리자 세션을 폐기한다.
     * @param {*} sessionId 입력값
     * @returns {Promise<any>} 처리 결과
     */
    async revokeSession(sessionId) {
        if (!sessionId) {
            return;
        }

        await executeQuery(`
            UPDATE admin_sessions
            SET revoked_at = COALESCE(revoked_at, NOW())
            WHERE session_id = ?
        `, [sessionId]);
    },

    /**
     * @description 관리자 사용자의 활성 세션을 폐기한다.
     * @param {*} adminId 입력값
     * @param {*} exceptSessionId 입력값
     * @returns {Promise<any>} 처리 결과
     */
    async revokeUserSessions(adminId, exceptSessionId = null) {
        const params = [adminId];
        let query = `
            UPDATE admin_sessions
            SET revoked_at = COALESCE(revoked_at, NOW())
            WHERE admin_id = ?
                AND revoked_at IS NULL
        `;

        if (exceptSessionId) {
            query += ` AND session_id != ?`;
            params.push(exceptSessionId);
        }

        await executeQuery(query, params);
    },

    /**
     * @description 만료되었거나 오래 전에 폐기된 관리자 세션을 정리한다.
     * @param {*} revokedRetentionDays 입력값
     * @returns {Promise<number>} 삭제된 세션 수
     */
    async cleanupExpiredSessions(revokedRetentionDays = 7) {
        const safeRetentionDays = parseIntegerEnv(revokedRetentionDays, {
            fallback: 7,
            min: 0,
            clamp: false
        });
        const revokedBefore = new Date(Date.now() - safeRetentionDays * 24 * 60 * 60 * 1000);

        const result = await executeQuery(`
            DELETE FROM admin_sessions
            WHERE expires_at < NOW()
                OR (revoked_at IS NOT NULL AND revoked_at < ?)
        `, [revokedBefore]);

        return result.affectedRows || 0;
    },

    /**
     * @description 관리자 사용자 모델에서 로그아웃을 처리한다.
     * @param {*} token 입력값
     * @returns {Promise<any>} 처리 결과
     */
    async logout(token) {
        try {
            const decoded = this.verifyToken(token);
            const user = await this.getById(decoded.id);

            await this.revokeSession(decoded.sid);

            if (user) {
                logger.auth('로그아웃 성공', { username: user.username }, {
                    userId: user.id,
                    logoutTime: new Date().toISOString()
                });
            }
        } catch (error) {
            logger.auth('로그아웃 (토큰 무효)', null, {
                error: error.message,
                logoutTime: new Date().toISOString()
            });
        }
    }
};
