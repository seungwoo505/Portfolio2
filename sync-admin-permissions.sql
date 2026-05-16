-- 관리자 권한 테이블과 현재 서버 코드에서 사용하는 권한명을 동기화한다.
-- 사용 예: mysql -u <user> -p <database> < sync-admin-permissions.sql

CREATE TABLE IF NOT EXISTS admin_permissions (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100) NOT NULL UNIQUE COMMENT '권한 이름',
    resource VARCHAR(50) NOT NULL COMMENT '리소스',
    action VARCHAR(50) NOT NULL COMMENT '액션',
    description TEXT COMMENT '권한 설명',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_resource_action (resource, action)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS admin_role_permissions (
    id INT AUTO_INCREMENT PRIMARY KEY,
    role VARCHAR(50) NOT NULL COMMENT '역할',
    permission_id INT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (permission_id) REFERENCES admin_permissions(id) ON DELETE CASCADE,
    UNIQUE KEY unique_role_permission (role, permission_id),
    INDEX idx_role (role)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS admin_user_permissions (
    id INT AUTO_INCREMENT PRIMARY KEY,
    admin_id INT NOT NULL COMMENT '관리자 사용자 ID',
    permission_id INT NOT NULL COMMENT '권한 ID',
    granted_by INT NULL COMMENT '권한을 부여한 사용자 ID',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (admin_id) REFERENCES admin_users(id) ON DELETE CASCADE,
    FOREIGN KEY (permission_id) REFERENCES admin_permissions(id) ON DELETE CASCADE,
    FOREIGN KEY (granted_by) REFERENCES admin_users(id) ON DELETE SET NULL,
    UNIQUE KEY unique_admin_permission (admin_id, permission_id),
    INDEX idx_admin_id (admin_id),
    INDEX idx_permission_id (permission_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO admin_permissions (name, resource, action, description) VALUES
('blog.create', 'blog', 'create', '블로그 포스트 생성'),
('blog.read', 'blog', 'read', '블로그 포스트 조회'),
('blog.update', 'blog', 'update', '블로그 포스트 수정'),
('blog.edit', 'blog', 'edit', '블로그 포스트 편집'),
('blog.delete', 'blog', 'delete', '블로그 포스트 삭제'),
('blog.publish', 'blog', 'publish', '블로그 포스트 발행 상태 변경'),
('projects.create', 'projects', 'create', '프로젝트 생성'),
('projects.read', 'projects', 'read', '프로젝트 조회'),
('projects.update', 'projects', 'update', '프로젝트 수정'),
('projects.delete', 'projects', 'delete', '프로젝트 삭제'),
('skills.create', 'skills', 'create', '기술 스택 생성'),
('skills.read', 'skills', 'read', '기술 스택 조회'),
('skills.update', 'skills', 'update', '기술 스택 수정'),
('skills.delete', 'skills', 'delete', '기술 스택 삭제'),
('tags.create', 'tags', 'create', '태그 생성'),
('tags.read', 'tags', 'read', '태그 조회'),
('tags.update', 'tags', 'update', '태그 수정'),
('tags.delete', 'tags', 'delete', '태그 삭제'),
('contacts.read', 'contacts', 'read', '연락처 메시지 조회'),
('contacts.update', 'contacts', 'update', '연락처 메시지 수정'),
('contacts.delete', 'contacts', 'delete', '연락처 메시지 삭제'),
('settings.read', 'settings', 'read', '사이트 설정 조회'),
('settings.update', 'settings', 'update', '사이트 설정 수정'),
('dashboard.read', 'dashboard', 'read', '관리자 대시보드 조회'),
('logs.read', 'logs', 'read', '관리자 활동 로그 조회'),
('files.delete', 'files', 'delete', '업로드 파일 삭제'),
('personal_info.update', 'personal_info', 'update', '개인 정보 수정'),
('social_links.create', 'social_links', 'create', '소셜 링크 생성'),
('experiences.create', 'experiences', 'create', '경력 생성'),
('experiences.update', 'experiences', 'update', '경력 수정'),
('experiences.delete', 'experiences', 'delete', '경력 삭제'),
('interests.create', 'interests', 'create', '관심사 생성'),
('interests.update', 'interests', 'update', '관심사 수정'),
('interests.delete', 'interests', 'delete', '관심사 삭제'),
('users.create', 'users', 'create', '관리자 계정 생성'),
('users.read', 'users', 'read', '관리자 계정 조회'),
('users.update', 'users', 'update', '관리자 계정 수정'),
('users.delete', 'users', 'delete', '관리자 계정 삭제')
ON DUPLICATE KEY UPDATE
    resource = VALUES(resource),
    action = VALUES(action),
    description = VALUES(description);

INSERT IGNORE INTO admin_role_permissions (role, permission_id)
SELECT 'super_admin', id FROM admin_permissions;

INSERT IGNORE INTO admin_role_permissions (role, permission_id)
SELECT 'admin', id
FROM admin_permissions
WHERE resource <> 'users';

INSERT IGNORE INTO admin_role_permissions (role, permission_id)
SELECT 'editor', id
FROM admin_permissions
WHERE name IN (
    'blog.create',
    'blog.read',
    'blog.update',
    'blog.edit',
    'blog.publish',
    'projects.create',
    'projects.read',
    'projects.update',
    'skills.create',
    'skills.read',
    'skills.update',
    'tags.create',
    'tags.read',
    'tags.update',
    'personal_info.update',
    'social_links.create',
    'experiences.create',
    'experiences.update',
    'interests.create',
    'interests.update'
);
