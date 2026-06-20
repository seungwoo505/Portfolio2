const {
    bcrypt,
    executeQuery,
    executeQuerySingle,
    hasOwn
} = require('./common');

module.exports = {
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
        let shouldRevokeSessions = false;

        for (const field of allowedFields) {
            if (hasOwn(data, field) && data[field] !== undefined) {
                updateFields.push(`${field} = ?`);
                updateValues.push(data[field]);
            }
        }

        if (hasOwn(data, 'password') && data.password !== undefined) {
            const passwordHash = await bcrypt.hash(data.password, 10);
            updateFields.push('password_hash = ?');
            updateValues.push(passwordHash);
            shouldRevokeSessions = true;
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

        if (shouldRevokeSessions) {
            await this.revokeUserSessions(id);
        }

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

    /**
     * @description 관리자 사용자 모델의 사용자 정보를 정제한다.
     * @param {*} user 입력값
     * @returns {any} 처리 결과
     */
    sanitizeUser(user) {
        const { password_hash, ...sanitized } = user;
        return sanitized;
    }
};
