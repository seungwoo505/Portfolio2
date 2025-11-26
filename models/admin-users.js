const { executeQuery, executeQuerySingle } = require('./db-utils');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const logger = require('../log');

const AdminUsers = {
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

        const token = this.generateToken(user, ipAddress);
        const refreshToken = this.generateRefreshToken(user, ipAddress);

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
    generateToken(user, ipAddress) {
        return jwt.sign(
            {
                id: user.id,
                username: user.username,
                role: user.role,
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
    generateRefreshToken(user, ipAddress) {
        return jwt.sign(
            {
                id: user.id,
                username: user.username,
                type: 'refresh', // 토큰 타입 구분
                ip: ipAddress,
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
     * @description 관리자 사용자 모델에서 로그아웃을 처리한다.
      * @param {*} token 입력값
     * @returns {Promise<any>} 처리 결과
     */
    async logout(token) {
        try {
            const decoded = this.verifyToken(token);
            const user = await this.getById(decoded.id);
            
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
        const { username, email, full_name, role, is_active } = data;

        const cleanParams = [
            username === undefined ? null : username,
            email === undefined ? null : email,
            full_name === undefined ? null : full_name,
            role === undefined ? null : role,
            is_active === undefined ? null : is_active,
            id
        ];

        await executeQuery(`
            UPDATE admin_users 
            SET username = COALESCE(?, username),
                email = COALESCE(?, email),
                full_name = COALESCE(?, full_name),
                role = COALESCE(?, role),
                is_active = COALESCE(?, is_active),
                updated_at = NOW()
            WHERE id = ?
        `, cleanParams);

        return await this.getById(id);
    },

    /**
     * @description 관리자 사용자 모델의 비밀번호를 변경한다.
      * @param {*} id 입력값
      * @param {*} oldPassword 입력값
      * @param {*} newPassword 입력값
     * @returns {Promise<any>} 처리 결과
     */
    async changePassword(id, oldPassword, newPassword) {
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
     * @description 관리자 사용자 모델의 권한 목록을 조회한다.
      * @param {*} userId 입력값
     * @returns {Promise<any>} 처리 결과
     */
    async getUserPermissions(userId) {
        return await executeQuery(`
            SELECT p.name, p.resource, p.action, p.description
            FROM admin_permissions p
            INNER JOIN admin_user_permissions up ON p.id = up.permission_id
            WHERE up.admin_id = ?
        `, [userId]);
    },

    /**
     * @description 관리자 사용자 모델에 권한이 있는지 확인한다.
      * @param {*} userId 입력값
      * @param {*} permissionName 입력값
     * @returns {Promise<any>} 처리 결과
     */
    async hasPermission(userId, permissionName) {
        const permission = await executeQuerySingle(`
            SELECT 1
            FROM admin_permissions p
            INNER JOIN admin_user_permissions up ON p.id = up.permission_id
            WHERE up.admin_id = ? AND p.name = ?
        `, [userId, permissionName]);

        return !!permission;
    }
};

module.exports = AdminUsers;
