const ActivityLogs = require('../models/activity-logs');
const logger = require('../log');

/**
 * 활동 로그 기록 헬퍼 함수 (보안 고려하여 기록)
 * @param {Object} req - Express request 객체
 * @param {string} action - 수행된 액션 (예: 'create', 'update', 'delete', 'login')
 * @param {string} resourceType - 리소스 타입 (예: 'blog', 'project', 'user', 'auth')
 * @param {string} resourceId - 리소스 ID (선택사항)
 * @param {string} resourceName - 리소스 이름 (선택사항)
 * @param {string} details - 상세 정보 (선택사항)
 */
async function logActivity(req, action, resourceType, resourceId = null, resourceName = null, details = null) {
    try {
        if (!req.admin || !req.admin.id) {
            logger.warn('활동 로그 기록 실패: 인증 정보 없음');
            return;
        }

        const maskedIP = maskIPAddress(req.ip);
        
        const sanitizedUserAgent = sanitizeUserAgent(req.headers['user-agent']);

        const logData = {
            user_id: req.admin.id,
            username: req.admin.username,
            action,
            resource_type: resourceType,
            resource_id: resourceId,
            resource_name: resourceName,
            details,
            ip_address: maskedIP,
            user_agent: sanitizedUserAgent
        };

        await ActivityLogs.create(logData);
        logger.info(`📝 활동 로그 기록: ${req.admin.username} - ${action} ${resourceType}`);
    } catch (error) {
        logger.error('활동 로그 기록 실패:', error);
    }
}

/**
 * IP 주소 마스킹 (보안 강화)
 * @param {string} ip - 원본 IP 주소
 * @returns {string} 마스킹된 IP 주소
 */
function maskIPAddress(ip) {
    if (!ip) return null;
    
    if (ip.includes('.')) {
        const parts = ip.split('.');
        if (parts.length === 4) {
            return `${parts[0]}.${parts[1]}.${parts[2]}.***`;
        }
    }
    
    if (ip.includes(':')) {
        const parts = ip.split(':');
        if (parts.length >= 4) {
            return `${parts[0]}:${parts[1]}::***`;
        }
    }
    
    return ip;
}

/**
 * User Agent에서 OS와 브라우저만 추출 (간단하게)
 * @param {string} userAgent - 원본 User Agent
 * @returns {string} OS + 브라우저 정보
 */
function sanitizeUserAgent(userAgent) {
    if (!userAgent) return null;
    
    let os = 'Unknown';
    let browser = 'Unknown';
    
    if (userAgent.includes('Windows')) {
        os = 'Windows';
    } else if (userAgent.includes('Mac OS X') || userAgent.includes('Macintosh')) {
        os = 'macOS';
    } else if (userAgent.includes('iPhone')) {
        os = 'iOS';
    } else if (userAgent.includes('Android')) {
        os = 'Android';
    } else if (userAgent.includes('Linux')) {
        os = 'Linux';
    }
    
    if (userAgent.includes('Chrome')) {
        browser = 'Chrome';
    } else if (userAgent.includes('Firefox')) {
        browser = 'Firefox';
    } else if (userAgent.includes('Safari')) {
        browser = 'Safari';
    } else if (userAgent.includes('Edge')) {
        browser = 'Edge';
    }
    
    return `${os} + ${browser}`;
}

/**
 * 간편한 로그 함수들
 */
const activityLogger = {
    login: (req) => logActivity(req, 'login', 'auth', null, null, '관리자 로그인'),
    
    logout: (req) => logActivity(req, 'logout', 'auth', null, null, '관리자 로그아웃'),
    
    blog: {
        create: (req, postId, postTitle) => logActivity(req, 'create', 'blog', postId, postTitle, '블로그 포스트 생성'),
        update: (req, postId, postTitle) => logActivity(req, 'update', 'blog', postId, postTitle, '블로그 포스트 수정'),
        delete: (req, postId, postTitle) => logActivity(req, 'delete', 'blog', postId, postTitle, '블로그 포스트 삭제'),
        publish: (req, postId, postTitle) => logActivity(req, 'publish', 'blog', postId, postTitle, '블로그 포스트 발행'),
        unpublish: (req, postId, postTitle) => logActivity(req, 'unpublish', 'blog', postId, postTitle, '블로그 포스트 비발행')
    },
    
    project: {
        create: (req, projectId, projectTitle) => logActivity(req, 'create', 'project', projectId, projectTitle, '프로젝트 생성'),
        update: (req, projectId, projectTitle) => logActivity(req, 'update', 'project', projectId, projectTitle, '프로젝트 수정'),
        delete: (req, projectId, projectTitle) => logActivity(req, 'delete', 'project', projectId, projectTitle, '프로젝트 삭제'),
        togglePublish: (req, projectId, projectTitle, isPublished) => logActivity(req, isPublished ? 'publish' : 'unpublish', 'project', projectId, projectTitle, `프로젝트 ${isPublished ? '발행' : '비발행'}`),
        toggleFeatured: (req, projectId, projectTitle, isFeatured) => logActivity(req, isFeatured ? 'feature' : 'unfeature', 'project', projectId, projectTitle, `프로젝트 ${isFeatured ? '대표 설정' : '대표 해제'}`)
    },
    
    tag: {
        create: (req, tagId, tagName) => logActivity(req, 'create', 'tag', tagId, tagName, '태그 생성'),
        update: (req, tagId, tagName) => logActivity(req, 'update', 'tag', tagId, tagName, '태그 수정'),
        delete: (req, tagId, tagName) => logActivity(req, 'delete', 'tag', tagId, tagName, '태그 삭제')
    },
    
    user: {
        create: (req, userId, username) => logActivity(req, 'create', 'user', userId, username, '사용자 생성'),
        update: (req, userId, username) => logActivity(req, 'update', 'user', userId, username, '사용자 정보 수정'),
        delete: (req, userId, username) => logActivity(req, 'delete', 'user', userId, username, '사용자 삭제'),
        toggleStatus: (req, userId, username, isActive) => logActivity(req, isActive ? 'activate' : 'deactivate', 'user', userId, username, `사용자 ${isActive ? '활성화' : '비활성화'}`)
    },
    
    contact: {
        markAsRead: (req, messageId) => logActivity(req, 'mark_read', 'contact', messageId, null, '연락처 메시지 읽음 처리'),
        markAsUnread: (req, messageId) => logActivity(req, 'mark_unread', 'contact', messageId, null, '연락처 메시지 읽지 않음 처리'),
        delete: (req, messageId) => logActivity(req, 'delete', 'contact', messageId, null, '연락처 메시지 삭제')
    },
    
    file: {
        upload: (req, filename) => logActivity(req, 'upload', 'file', null, filename, '파일 업로드'),
        delete: (req, filename) => logActivity(req, 'delete', 'file', null, filename, '파일 삭제')
    },
    
    settings: {
        update: (req, settingKey) => logActivity(req, 'update', 'settings', null, settingKey, '사이트 설정 변경')
    },
    
    general: {
        view: (req, resourceType, resourceId, resourceName) => logActivity(req, 'view', resourceType, resourceId, resourceName, '리소스 조회'),
        export: (req, resourceType) => logActivity(req, 'export', resourceType, null, null, `${resourceType} 데이터 내보내기`),
        import: (req, resourceType) => logActivity(req, 'import', resourceType, null, null, `${resourceType} 데이터 가져오기`)
    }
};

module.exports = {
    logActivity,
    activityLogger
};
