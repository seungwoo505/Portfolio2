const bcrypt = require('bcryptjs');

const permissions = [
    ['dashboard.read', 'dashboard', 'read', '대시보드 조회'],
    ['blog.create', 'blog', 'create', '블로그 생성'],
    ['blog.read', 'blog', 'read', '블로그 조회'],
    ['blog.update', 'blog', 'update', '블로그 수정'],
    ['blog.edit', 'blog', 'edit', '블로그 편집'],
    ['blog.delete', 'blog', 'delete', '블로그 삭제'],
    ['blog.publish', 'blog', 'publish', '블로그 발행 상태 변경'],
    ['projects.create', 'projects', 'create', '프로젝트 생성'],
    ['projects.read', 'projects', 'read', '프로젝트 조회'],
    ['projects.update', 'projects', 'update', '프로젝트 수정'],
    ['projects.delete', 'projects', 'delete', '프로젝트 삭제'],
    ['personal_info.read', 'personal_info', 'read', '개인 정보 조회'],
    ['personal_info.update', 'personal_info', 'update', '개인 정보 수정'],
    ['social_links.read', 'social_links', 'read', '소셜 링크 조회'],
    ['social_links.create', 'social_links', 'create', '소셜 링크 생성'],
    ['social_links.update', 'social_links', 'update', '소셜 링크 수정'],
    ['social_links.delete', 'social_links', 'delete', '소셜 링크 삭제'],
    ['skills.create', 'skills', 'create', '기술 스택 생성'],
    ['skills.read', 'skills', 'read', '기술 스택 조회'],
    ['skills.update', 'skills', 'update', '기술 스택 수정'],
    ['skills.delete', 'skills', 'delete', '기술 스택 삭제'],
    ['tags.create', 'tags', 'create', '태그 생성'],
    ['tags.read', 'tags', 'read', '태그 조회'],
    ['tags.update', 'tags', 'update', '태그 수정'],
    ['tags.delete', 'tags', 'delete', '태그 삭제'],
    ['contacts.read', 'contacts', 'read', '문의 조회'],
    ['contacts.update', 'contacts', 'update', '문의 수정'],
    ['contacts.delete', 'contacts', 'delete', '문의 삭제'],
    ['settings.read', 'settings', 'read', '설정 조회'],
    ['settings.update', 'settings', 'update', '설정 수정'],
    ['users.manage', 'users', 'manage', '관리자 계정 관리'],
    ['logs.read', 'logs', 'read', '활동 로그 조회'],
    ['files.create', 'files', 'create', '업로드 파일 생성'],
    ['files.delete', 'files', 'delete', '업로드 파일 삭제'],
    ['experiences.read', 'experiences', 'read', '경력 조회'],
    ['experiences.create', 'experiences', 'create', '경력 생성'],
    ['experiences.update', 'experiences', 'update', '경력 수정'],
    ['experiences.delete', 'experiences', 'delete', '경력 삭제'],
    ['interests.read', 'interests', 'read', '관심사 조회'],
    ['interests.create', 'interests', 'create', '관심사 생성'],
    ['interests.update', 'interests', 'update', '관심사 수정'],
    ['interests.delete', 'interests', 'delete', '관심사 삭제']
];

const rolePermissions = {
    admin: permissions
        .map(([name]) => name)
        .filter((name) => !['users.manage', 'logs.read'].includes(name)),
    editor: [
        'dashboard.read',
        'blog.create',
        'blog.read',
        'blog.update',
        'blog.edit',
        'blog.publish',
        'projects.read',
        'tags.read',
        'skills.read',
        'personal_info.read',
        'personal_info.update',
        'social_links.read',
        'social_links.create',
        'social_links.update',
        'experiences.read',
        'interests.read'
    ]
};

async function up(connection, logger) {
    for (const [name, resource, action, description] of permissions) {
        await connection.execute(`
            INSERT INTO admin_permissions (name, resource, action, description)
            VALUES (?, ?, ?, ?)
            ON DUPLICATE KEY UPDATE
                resource = VALUES(resource),
                action = VALUES(action),
                description = VALUES(description)
        `, [name, resource, action, description]);
    }

    for (const [role, permissionNames] of Object.entries(rolePermissions)) {
        for (const permissionName of permissionNames) {
            await connection.execute(`
                INSERT IGNORE INTO admin_role_permissions (role, permission_id)
                SELECT ?, id FROM admin_permissions WHERE name = ?
            `, [role, permissionName]);
        }
    }

    const username = process.env.ADMIN_BOOTSTRAP_USERNAME;
    const email = process.env.ADMIN_BOOTSTRAP_EMAIL;
    const password = process.env.ADMIN_BOOTSTRAP_PASSWORD;
    const fullName = process.env.ADMIN_BOOTSTRAP_FULL_NAME || 'Super Admin';

    if (!username || !email || !password) {
        throw new Error('초기 관리자 계정 생성을 위해 ADMIN_BOOTSTRAP_USERNAME, ADMIN_BOOTSTRAP_EMAIL, ADMIN_BOOTSTRAP_PASSWORD를 설정해야 합니다.');
    }

    const [existing] = await connection.execute(
        'SELECT id FROM admin_users WHERE username = ? OR email = ? LIMIT 1',
        [username, email]
    );

    if (existing.length > 0) {
        logger.info('초기 관리자 계정이 이미 존재합니다.', { username, email });
        return;
    }

    const passwordHash = await bcrypt.hash(password, 10);
    await connection.execute(`
        INSERT INTO admin_users (username, email, password_hash, full_name, role, is_active)
        VALUES (?, ?, ?, ?, 'super_admin', TRUE)
    `, [username, email, passwordHash, fullName]);

    logger.info('초기 super_admin 계정을 생성했습니다.', { username, email });
}

module.exports = {
    up,
    permissions,
    rolePermissions
};
