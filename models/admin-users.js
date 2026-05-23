const { executeQuery, executeQuerySingle } = require('./db-utils');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const logger = require('../log');

const hasOwn = (value, key) => Object.prototype.hasOwnProperty.call(value, key);

const AdminUsers = {
    _userPermissionColumn: undefined,

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
                ip: ipAddress, // IP 주소 포함
                iat: Math.floor(Date.now() / 1000) // 발급 시간
            },
            process.env.JWT_SECRET,
            { expiresIn: '30m' } // 30분으로 단축
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
                type: 'refresh', // 토큰 타입 구분
                sid: sessionId,
                ip: ipAddress,
                jti: crypto.randomUUID(),
                iat: Math.floor(Date.now() / 1000)
            },
            process.env.JWT_REFRESH_SECRET || process.env.JWT_SECRET,
            { expiresIn: '12h' } // 12시간 만료
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
    },

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
        const retentionDays = Number.parseInt(revokedRetentionDays, 10);
        const safeRetentionDays = Number.isInteger(retentionDays) && retentionDays >= 0 ? retentionDays : 7;
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
    },

    /**
     * @description 관리자 사용자 모델에서 ID로 조회한다.
      * @param {*} id 입력값
     * @returns {Promise<any>} 처리 결과
     */
    async getById(id) {
        const user = await executeQuerySingle(`
            SELECT * FROM admin_users WHERE id = ?
        `, [id]);

        return user ? this.sanitizeUser(user) : null;
    },

    /**
     * @description 관리자 사용자 모델에서 사용자 이름으로 조회한다.
      * @param {*} username 입력값
     * @returns {Promise<any>} 처리 결과
     */
    async getByUsername(username) {
        const user = await executeQuerySingle(`
            SELECT * FROM admin_users WHERE username = ?
        `, [username]);

        return user ? this.sanitizeUser(user) : null;
    },

    /**
     * @description 관리자 사용자 모델의 전체 목록을 조회한다.
     * @returns {Promise<any>} 처리 결과
     */
    async getAll() {
        const users = await executeQuery(`
            SELECT * FROM admin_users ORDER BY created_at DESC
        `);

        return users.map(user => this.sanitizeUser(user));
    },

    /**
     * @description 관리자 사용자 모델에 계정을 생성한다.
      * @param {*} data 입력값
     * @returns {Promise<any>} 처리 결과
     */
    async create(data) {
        const { username, email, password, full_name, role = 'admin' } = data;

        const existing = await executeQuerySingle(`
            SELECT id FROM admin_users WHERE username = ? OR email = ?
        `, [username, email]);

        if (existing) {
            throw new Error('이미 존재하는 사용자명 또는 이메일입니다.');
        }

        const password_hash = await bcrypt.hash(password, 10);

        const result = await executeQuery(`
            INSERT INTO admin_users (username, email, password_hash, full_name, role)
            VALUES (?, ?, ?, ?, ?)
        `, [username, email, password_hash, full_name, role]);

        return result.insertId;
    },

    /**
     * @description 관리자 사용자 모델의 정보를 수정한다.
      * @param {*} id 입력값
      * @param {*} data 입력값
     * @returns {Promise<any>} 처리 결과
     */
    async update(id, data) {
        const allowedFields = [
            'username',
            'email',
            'full_name',
            'role',
            'is_active'
        ];
        const updateFields = [];
        const updateValues = [];

        for (const field of allowedFields) {
            if (hasOwn(data, field) && data[field] !== undefined) {
                updateFields.push(`${field} = ?`);
                updateValues.push(data[field]);
            }
        }

        if (updateFields.length === 0) {
            return await this.getById(id);
        }

        updateFields.push('updated_at = NOW()');
        updateValues.push(id);

        await executeQuery(
            `UPDATE admin_users SET ${updateFields.join(', ')} WHERE id = ?`,
            updateValues
        );

        return await this.getById(id);
    },

    /**
     * @description 관리자 사용자 모델의 비밀번호를 변경한다.
      * @param {*} id 입력값
      * @param {*} oldPassword 입력값
      * @param {*} newPassword 입력값
     * @returns {Promise<any>} 처리 결과
     */
    async changePassword(id, oldPassword, newPassword, currentSessionId = null) {
        const user = await executeQuerySingle(`
            SELECT password_hash FROM admin_users WHERE id = ?
        `, [id]);

        if (!user) {
            throw new Error('사용자를 찾을 수 없습니다.');
        }

        const isValid = await bcrypt.compare(oldPassword, user.password_hash);
        if (!isValid) {
            throw new Error('기존 비밀번호가 올바르지 않습니다.');
        }

        const newPasswordHash = await bcrypt.hash(newPassword, 10);

        await executeQuery(`
            UPDATE admin_users 
            SET password_hash = ?, updated_at = NOW()
            WHERE id = ?
        `, [newPasswordHash, id]);

        await this.revokeUserSessions(id, currentSessionId);

    },

    /**
     * @description 관리자 사용자 모델에서 계정을 삭제한다.
      * @param {*} id 입력값
     * @returns {Promise<any>} 처리 결과
     */
    async delete(id) {
        await executeQuery('DELETE FROM admin_users WHERE id = ?', [id]);
    },

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
    },

    /**
     * @description 관리자 사용자 모델의 사용자 정보를 정제한다.
      * @param {*} user 입력값
     * @returns {any} 처리 결과
     */
    sanitizeUser(user) {
        const { password_hash, ...sanitized } = user;
        return sanitized;
    },

    /**
     * @description 사용자별 권한 매핑 테이블의 사용자 ID 컬럼명을 확인한다.
     * @returns {Promise<string|null>} admin_id, user_id 또는 null
     */
    async getUserPermissionColumn() {
        if (this._userPermissionColumn !== undefined) {
            return this._userPermissionColumn;
        }

        try {
            const adminIdColumn = await executeQuerySingle(`
                SHOW COLUMNS FROM admin_user_permissions LIKE 'admin_id'
            `);
            if (adminIdColumn) {
                this._userPermissionColumn = 'admin_id';
                return this._userPermissionColumn;
            }

            const userIdColumn = await executeQuerySingle(`
                SHOW COLUMNS FROM admin_user_permissions LIKE 'user_id'
            `);
            this._userPermissionColumn = userIdColumn ? 'user_id' : null;
            return this._userPermissionColumn;
        } catch (error) {
            logger.warn('사용자별 권한 테이블 컬럼 확인 실패', { error: error.message });
            this._userPermissionColumn = null;
            return this._userPermissionColumn;
        }
    },

    /**
     * @description 역할 기반 권한 목록을 조회한다.
     * @param {string} role 관리자 역할
     * @returns {Promise<Array>} 역할 권한 목록
     */
    async getRolePermissions(role) {
        try {
            return await executeQuery(`
                SELECT p.name, p.resource, p.action, p.description
                FROM admin_permissions p
                INNER JOIN admin_role_permissions rp ON p.id = rp.permission_id
                WHERE rp.role = ?
            `, [role]);
        } catch (error) {
            logger.warn('역할 권한 조회 실패', { role, error: error.message });
            return [];
        }
    },

    /**
     * @description 사용자에게 직접 부여된 권한 목록을 조회한다.
     * @param {number} userId 관리자 사용자 ID
     * @returns {Promise<Array>} 사용자별 권한 목록
     */
    async getDirectUserPermissions(userId) {
        const userColumn = await this.getUserPermissionColumn();
        if (!userColumn) {
            return [];
        }

        try {
            return await executeQuery(`
                SELECT p.name, p.resource, p.action, p.description
                FROM admin_permissions p
                INNER JOIN admin_user_permissions up ON p.id = up.permission_id
                WHERE up.${userColumn} = ?
            `, [userId]);
        } catch (error) {
            logger.warn('사용자별 권한 조회 실패', { userId, error: error.message });
            return [];
        }
    },


    /**
     * @description 관리자 사용자 모델의 권한 목록을 조회한다.
      * @param {*} userId 입력값
     * @returns {Promise<any>} 처리 결과
     */
    async getUserPermissions(userId) {
        const user = await this.getById(userId);
        if (!user) {
            return [];
        }

        const [rolePermissions, directPermissions] = await Promise.all([
            this.getRolePermissions(user.role),
            this.getDirectUserPermissions(userId)
        ]);

        return Array.from(
            new Map(
                [...rolePermissions, ...directPermissions].map(permission => [permission.name, permission])
            ).values()
        );
    },

    /**
     * @description 관리자 사용자 모델에 권한이 있는지 확인한다.
      * @param {*} userId 입력값
      * @param {*} permissionName 입력값
     * @returns {Promise<any>} 처리 결과
     */
    async hasPermission(userId, permissionName) {
        const user = await this.getById(userId);
        if (!user) {
            return false;
        }

        if (user.role === 'super_admin') {
            return true;
        }

        try {
            const rolePermission = await executeQuerySingle(`
                SELECT 1
                FROM admin_permissions p
                INNER JOIN admin_role_permissions rp ON p.id = rp.permission_id
                WHERE rp.role = ? AND p.name = ?
                LIMIT 1
            `, [user.role, permissionName]);

            if (rolePermission) {
                return true;
            }
        } catch (error) {
            logger.warn('역할 권한 확인 실패', {
                userId,
                role: user.role,
                permissionName,
                error: error.message
            });
        }

        const userColumn = await this.getUserPermissionColumn();
        if (!userColumn) {
            return false;
        }

        try {
            const directPermission = await executeQuerySingle(`
                SELECT 1
                FROM admin_permissions p
                INNER JOIN admin_user_permissions up ON p.id = up.permission_id
                WHERE up.${userColumn} = ? AND p.name = ?
                LIMIT 1
            `, [userId, permissionName]);

            return !!directPermission;
        } catch (error) {
            logger.warn('사용자별 권한 확인 실패', { userId, permissionName, error: error.message });
            return false;
        }
    }
};

module.exports = AdminUsers;
