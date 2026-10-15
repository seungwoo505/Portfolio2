const {
    bcrypt,
    createQueryContext,
    defaultQueryContext,
    executeQuery,
    executeQuerySingle,
    executeTransaction,
    hasOwn
} = require('./common');
const { assertPasswordByteLimit, getPasswordByteLimitError } = require('../../utils/admin-validation');
const { assertIdentifiersAvailable, withIdentifierWriteTransaction } = require('./identifier-lock');

module.exports = {
    /**
     * @description 관리자 사용자 모델에서 ID로 조회한다.
     * @param {*} id 입력값
     * @returns {Promise<any>} 처리 결과
     */
    async getById(id, db = defaultQueryContext) {
        const user = await db.querySingle(`
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
        const { username, email, password, full_name = null, role = 'admin' } = data;
        assertPasswordByteLimit(password);

        const password_hash = await bcrypt.hash(password, 10);
        return await withIdentifierWriteTransaction(async (connection) => {
            const db = createQueryContext(connection);
            await assertIdentifiersAvailable(db, username, email);
            const result = await db.query(`
                INSERT INTO admin_users (username, email, password_hash, full_name, role)
                VALUES (?, ?, ?, ?, ?)
            `, [username, email, password_hash, full_name, role]);
            return result.insertId;
        });
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
            assertPasswordByteLimit(data.password);
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

        const changesIdentifiers = ['username', 'email'].some(field => hasOwn(data, field) && data[field] !== undefined);
        if (shouldRevokeSessions || changesIdentifiers) {
            const transaction = changesIdentifiers ? withIdentifierWriteTransaction : executeTransaction;
            return await transaction(async (connection) => {
                const db = createQueryContext(connection);
                const currentUser = await db.querySingle('SELECT * FROM admin_users WHERE id = ? FOR UPDATE', [id]);
                if (changesIdentifiers && currentUser) {
                    await assertIdentifiersAvailable(db,
                        hasOwn(data, 'username') && data.username !== undefined ? data.username : currentUser.username,
                        hasOwn(data, 'email') && data.email !== undefined ? data.email : currentUser.email,
                        id);
                }
                await db.query(
                    `UPDATE admin_users SET ${updateFields.join(', ')} WHERE id = ?`,
                    updateValues
                );
                if (shouldRevokeSessions) await this.revokeUserSessions(id, null, db);
                return await this.getById(id, db);
            });
        }

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
        assertPasswordByteLimit(newPassword);
        const user = await executeQuerySingle(`
            SELECT password_hash FROM admin_users WHERE id = ?
        `, [id]);

        if (!user) {
            throw new Error('사용자를 찾을 수 없습니다.');
        }

        const isValid = typeof oldPassword === 'string'
            && !getPasswordByteLimitError(oldPassword)
            && await bcrypt.compare(oldPassword, user.password_hash);
        if (!isValid) {
            throw new Error('기존 비밀번호가 올바르지 않습니다.');
        }

        const newPasswordHash = await bcrypt.hash(newPassword, 10);

        await executeTransaction(async (connection) => {
            const db = createQueryContext(connection);
            const currentUser = await db.querySingle(`
                SELECT password_hash FROM admin_users WHERE id = ? FOR UPDATE
            `, [id]);
            if (!currentUser) {
                throw new Error('사용자를 찾을 수 없습니다.');
            }
            if (currentUser.password_hash !== user.password_hash) {
                throw new Error('기존 비밀번호가 올바르지 않습니다.');
            }

            await db.query(`
                UPDATE admin_users
                SET password_hash = ?, updated_at = NOW()
                WHERE id = ?
            `, [newPasswordHash, id]);

            await this.revokeUserSessions(id, currentSessionId, db);
        });
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
export {};
