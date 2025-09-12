const { executeQuery, executeQuerySingle } = require('./db-utils');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const logger = require('../log');

const AdminUsers = {
    // 관리자 로그인
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

        // 계정 잠금 확인
        if (user.locked_until && new Date(user.locked_until) > new Date()) {
            logger.security('로그인 실패 - 계정 잠금', {
                username: user.username,
                lockedUntil: user.locked_until,
                ipAddress
            });
            throw new Error('계정이 일시적으로 잠겨있습니다.');
        }

        // 패스워드 확인
        const isValidPassword = await bcrypt.compare(password, user.password_hash);

        if (!isValidPassword) {
            logger.security('로그인 실패 - 잘못된 비밀번호', {
                username: user.username,
                failedAttempts: user.failed_login_attempts + 1,
                ipAddress
            });
            // 실패 횟수 증가
            await this.incrementFailedAttempts(user.id);
            throw new Error('비밀번호가 올바르지 않습니다.');
        }

        // 로그인 성공 처리
        await this.handleSuccessfulLogin(user.id, ipAddress);

        // JWT 토큰 생성 (IP 주소 포함)
        const token = this.generateToken(user, ipAddress);
        const refreshToken = this.generateRefreshToken(user, ipAddress);

        // Stateless 방식: 세션 저장 제거 (활동 로그만 기록)
        logger.auth('로그인 성공', this.sanitizeUser(user), { ipAddress });

        return {
            user: this.sanitizeUser(user),
            token,
            refreshToken
        };
    },

    // JWT 토큰 생성 (보안 강화: 30분 만료)
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

    // Refresh Token 생성 (12시간 만료)
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

    // Access Token 검증
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

    // Refresh Token 검증
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

    // Stateless 로그아웃 (활동 로그만 기록)
    async logout(token) {
        try {
            // JWT 토큰에서 사용자 정보 추출
            const decoded = this.verifyToken(token);
            const user = await this.getById(decoded.id);
            
            if (user) {
                logger.auth('로그아웃 성공', { username: user.username }, {
                    userId: user.id,
                    logoutTime: new Date().toISOString()
                });
            }
        } catch (error) {
            // 토큰이 유효하지 않아도 로그아웃은 성공으로 처리
            logger.auth('로그아웃 (토큰 무효)', null, {
                error: error.message,
                logoutTime: new Date().toISOString()
            });
        }
    },

    // 사용자 정보 조회
    async getById(id) {
        const user = await executeQuerySingle(`
            SELECT * FROM admin_users WHERE id = ?
        `, [id]);

        return user ? this.sanitizeUser(user) : null;
    },

    async getByUsername(username) {
        const user = await executeQuerySingle(`
            SELECT * FROM admin_users WHERE username = ?
        `, [username]);

        return user ? this.sanitizeUser(user) : null;
    },

    // 모든 관리자 조회
    async getAll() {
        const users = await executeQuery(`
            SELECT * FROM admin_users ORDER BY created_at DESC
        `);

        return users.map(user => this.sanitizeUser(user));
    },

    // 새 관리자 생성
    async create(data) {
        const { username, email, password, full_name, role = 'admin' } = data;

        // 중복 확인
        const existing = await executeQuerySingle(`
            SELECT id FROM admin_users WHERE username = ? OR email = ?
        `, [username, email]);

        if (existing) {
            throw new Error('이미 존재하는 사용자명 또는 이메일입니다.');
        }

        // 패스워드 해시화
        const password_hash = await bcrypt.hash(password, 10);

        const result = await executeQuery(`
            INSERT INTO admin_users (username, email, password_hash, full_name, role)
            VALUES (?, ?, ?, ?, ?)
        `, [username, email, password_hash, full_name, role]);

        return result.insertId;
    },

    // 관리자 정보 수정
    async update(id, data) {
        const { username, email, full_name, role, is_active } = data;

        // undefined 값을 null로 변환
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

    // 패스워드 변경
    async changePassword(id, oldPassword, newPassword) {
        const user = await executeQuerySingle(`
            SELECT password_hash FROM admin_users WHERE id = ?
        `, [id]);

        if (!user) {
            throw new Error('사용자를 찾을 수 없습니다.');
        }

        // 기존 패스워드 확인
        const isValid = await bcrypt.compare(oldPassword, user.password_hash);
        if (!isValid) {
            throw new Error('기존 비밀번호가 올바르지 않습니다.');
        }

        // 새 패스워드 해시화
        const newPasswordHash = await bcrypt.hash(newPassword, 10);

        await executeQuery(`
            UPDATE admin_users 
            SET password_hash = ?, updated_at = NOW()
            WHERE id = ?
        `, [newPasswordHash, id]);

        // Stateless 방식: 세션 무효화 제거 (JWT 토큰은 만료 시간에 따라 자동 무효화)
    },

    // 관리자 삭제
    async delete(id) {
        await executeQuery('DELETE FROM admin_users WHERE id = ?', [id]);
    },

    // 실패 횟수 증가
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

    // 로그인 성공 처리
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

    // 사용자 정보 정리 (패스워드 등 민감 정보 제거)
    sanitizeUser(user) {
        const { password_hash, ...sanitized } = user;
        return sanitized;
    },

    // Stateless 방식: 세션 정리 불필요 (JWT는 자체 만료)

    // 사용자 권한 조회
    async getUserPermissions(userId) {
        return await executeQuery(`
            SELECT p.name, p.resource, p.action, p.description
            FROM admin_permissions p
            INNER JOIN admin_user_permissions up ON p.id = up.permission_id
            WHERE up.admin_id = ?
        `, [userId]);
    },

    // 권한 확인
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
