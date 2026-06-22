const {
    executeQuery,
    executeQuerySingle,
    logger
} = require('./common');

module.exports = {
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
export {};
