const AdminUsers = require('../models/admin-users');
const AdminActivityLogs = require('../models/admin-activity-logs');
const logger = require('../log');

/**
 * @description 인증 토큰을 검증한다.
  * @param {*} req 입력값
  * @param {*} res 입력값
  * @param {*} next 입력값
 * @returns {Promise<any>} 처리 결과
 */
const authenticateToken = async (req, res, next) => {
    try {
        const authHeader = req.headers['authorization'];
        const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN
        const refreshToken = req.headers['x-refresh-token']; // Refresh Token

        if (!token) {
            return res.status(401).json({
                success: false,
                message: '인증 토큰이 필요합니다.'
            });
        }

        try {
            const decoded = AdminUsers.verifyToken(token);
        
            const clientIP = req.ip || req.connection.remoteAddress;
            if (decoded.ip && decoded.ip !== clientIP) {
                return res.status(401).json({
                    success: false,
                    message: '토큰이 다른 IP에서 발급되었습니다.'
                });
            }
            
            const user = await AdminUsers.getById(decoded.id);
            if (!user || !user.is_active) {
                return res.status(401).json({
                    success: false,
                    message: '비활성화된 사용자입니다.'
                });
            }

            await AdminUsers.assertActiveSession(decoded.sid, decoded.id);

            req.admin = {
                id: decoded.id,
                username: decoded.username,
                role: decoded.role,
                sessionId: decoded.sid
            };

            next();
        } catch (tokenError) {
            if (refreshToken) {
                try {
                    const refreshDecoded = AdminUsers.verifyRefreshToken(refreshToken);
                    
                    const clientIP = req.ip || req.connection.remoteAddress;
                    if (refreshDecoded.ip && refreshDecoded.ip !== clientIP) {
                        return res.status(401).json({
                            success: false,
                            message: 'Refresh Token이 다른 IP에서 발급되었습니다.'
                        });
                    }

                    const user = await AdminUsers.getById(refreshDecoded.id);
                    if (!user || !user.is_active) {
                        return res.status(401).json({
                            success: false,
                            message: '비활성화된 사용자입니다.'
                        });
                    }

                    const newRefreshToken = await AdminUsers.rotateRefreshSession(refreshToken, refreshDecoded, user, clientIP);

                    const newToken = AdminUsers.generateToken(user, clientIP, refreshDecoded.sid);
                    
                    req.admin = {
                        id: user.id,
                        username: user.username,
                        role: user.role,
                        sessionId: refreshDecoded.sid
                    };

                    res.setHeader('X-New-Token', newToken);
                    res.setHeader('X-New-Refresh-Token', newRefreshToken);
                    
                    logger.info('토큰 자동 재발급 성공', { 
                        userId: user.id, 
                        username: user.username,
                        ip: clientIP 
                    });

                    next();
                } catch (refreshError) {
                    logger.warn('토큰 재발급 실패', { 
                        error: refreshError.message,
                        ip: req.ip || req.connection.remoteAddress
                    });
                    
                    return res.status(401).json({
                        success: false,
                        message: '토큰이 만료되었습니다. 다시 로그인해주세요.'
                    });
                }
            } else {
                return res.status(401).json({
                    success: false,
                    message: '토큰이 만료되었습니다. 다시 로그인해주세요.'
                });
            }
        }
    } catch (error) {
        logger.error('인증 미들웨어 오류', { error: error.message });
        return res.status(500).json({
            success: false,
            message: '인증 처리 중 오류가 발생했습니다.'
        });
    }
};

/**
 * @description 특정 권한이 있는지 검사한다.
  * @param {*} permissionName 입력값
 * @returns {any} 처리 결과
 */
const requirePermission = (permissionName) => {
    return async (req, res, next) => {
        try {
            if (!req.admin) {
                return res.status(401).json({
                    success: false,
                    message: '인증이 필요합니다.'
                });
            }

            if (req.admin.role === 'super_admin') {
                return next();
            }

            const hasPermission = await AdminUsers.hasPermission(req.admin.id, permissionName);
            
            if (!hasPermission) {
                logger.warn('권한 인가 실패', {
                    requestId: req.requestId,
                    adminId: req.admin.id,
                    permission: permissionName
                });

                return res.status(403).json({
                    success: false,
                    message: '권한이 부족합니다.'
                });
            }

            next();
        } catch (error) {
            logger.error('권한 확인 실패', {
                requestId: req.requestId,
                adminId: req.admin?.id,
                permission: permissionName,
                error: error.message,
                stack: error.stack
            });

            return res.status(500).json({
                success: false,
                message: '권한 확인 중 오류가 발생했습니다.'
            });
        }
    };
};

/**
 * @description 특정 역할이 있는지 검사한다.
  * @param {*} roles 입력값
 * @returns {any} 처리 결과
 */
const requireRole = (roles) => {
    return (req, res, next) => {
        if (!req.admin) {
            return res.status(401).json({
                success: false,
                message: '인증이 필요합니다.'
            });
        }

        const allowedRoles = Array.isArray(roles) ? roles : [roles];
        
        if (!allowedRoles.includes(req.admin.role)) {
            logger.warn('역할 인가 실패', {
                requestId: req.requestId,
                adminId: req.admin.id,
                currentRole: req.admin.role,
                requiredRoles: allowedRoles
            });

            return res.status(403).json({
                success: false,
                message: '접근 권한이 부족합니다.'
            });
        }

        next();
    };
};

const actionLabels = {
    admin_login: '로그인',
    admin_login_failed: '로그인 실패',
    admin_logout: '로그아웃',
    change_password: '비밀번호 변경',
    create_admin: '관리자 생성',
    update_admin: '관리자 수정',
    delete_admin: '관리자 삭제',
    create_blog_post: '블로그 생성',
    update_blog_post: '블로그 수정',
    publish_blog_post: '블로그 발행',
    feature_blog_post: '블로그 추천 변경',
    delete_blog_post: '블로그 삭제',
    create_project: '프로젝트 생성',
    update_project: '프로젝트 수정',
    delete_project: '프로젝트 삭제',
    create_tag: '태그 생성',
    update_tag: '태그 수정',
    delete_tag: '태그 삭제',
    mark_contact_read: '연락처 읽음',
    delete_contact: '연락처 삭제',
    update_settings: '설정 수정',
    upload_image: '이미지 업로드',
    delete_image: '이미지 삭제',
    create_skill_category: '스킬 카테고리 생성',
    delete_skill_category: '스킬 카테고리 삭제',
    create_skill: '기술 스택 생성',
    update_skill: '기술 스택 수정',
    delete_skill: '기술 스택 삭제',
    toggle_skill_featured: '기술 스택 추천 변경',
    update_skill_order: '기술 스택 순서 변경',
    update_personal_info: '개인 정보 수정',
    create_social_link: '소셜 링크 생성',
    update_social_link: '소셜 링크 수정',
    delete_social_link: '소셜 링크 삭제',
    create_experience: '경력 생성',
    update_experience: '경력 수정',
    delete_experience: '경력 삭제',
    create_interest: '관심사 생성',
    update_interest: '관심사 수정',
    delete_interest: '관심사 삭제'
};

const actionVerbs = {
    create: '생성',
    update: '수정',
    delete: '삭제',
    publish: '발행',
    feature: '추천 변경',
    upload: '업로드',
    mark: '상태 변경',
    toggle: '추천 변경',
    change: '변경'
};

const resourceLabels = {
    admin: '관리자',
    users: '관리자',
    projects: '프로젝트',
    blog: '블로그',
    posts: '블로그',
    tags: '태그',
    contacts: '연락처',
    settings: '설정',
    images: '이미지',
    uploads: '파일',
    skills: '기술 스택',
    'personal-info': '개인 정보',
    'social-links': '소셜 링크',
    experiences: '경력',
    interests: '관심사'
};

const getClientIp = (req) => {
    const ip = req.ip || req.connection.remoteAddress || null;
    return ip && ip.startsWith('::ffff:') ? ip.substring(7) : ip;
};

const summarizeUserAgent = (userAgent = '') => {
    if (!userAgent) {
        return null;
    }

    const os = userAgent.includes('Windows') ? 'Windows'
        : userAgent.includes('Macintosh') || userAgent.includes('Mac OS X') ? 'macOS'
            : userAgent.includes('Android') ? 'Android'
                : userAgent.includes('iPhone') || userAgent.includes('iPad') ? 'iOS'
                    : userAgent.includes('Linux') ? 'Linux'
                        : 'Unknown';

    const browser = userAgent.includes('Edg/') ? 'Edge'
        : userAgent.includes('Chrome') ? 'Chrome'
            : userAgent.includes('Firefox') ? 'Firefox'
                : userAgent.includes('Safari') ? 'Safari'
                    : 'Unknown';

    return `${os} | ${browser}`;
};

const inferResourceType = (req) => {
    const pathSegments = String(req.originalUrl || '')
        .split('?')[0]
        .split('/')
        .filter(Boolean);
    const apiIndex = pathSegments.indexOf('api');
    const apiPath = apiIndex >= 0 ? pathSegments.slice(apiIndex + 1) : pathSegments;

    if (apiPath[0] === 'admin' && apiPath[1]) {
        return apiPath[1];
    }
    if (apiPath[0]) {
        return apiPath[0];
    }

    return req.baseUrl.split('/').pop() || 'unknown';
};

const getResourceId = (req) => (
    req.params.id ||
    req.params.slug ||
    req.params.postId ||
    req.params.projectId ||
    req.body?.id ||
    null
);

const buildActivityDetails = (action, req, resourceType, resourceId) => {
    const resourceLabel = resourceLabels[resourceType] || resourceType;
    const actionPrefix = action.split('_')[0];
    const label = actionVerbs[actionPrefix] || actionLabels[action] || action.replace(/_/g, ' ');
    const safeBody = logger.redact(req.body || {});
    const changedFields = ['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method)
        ? Object.keys(safeBody).filter(key => safeBody[key] !== undefined)
        : [];

    const targetName = safeBody.title || safeBody.name || safeBody.username || safeBody.platform;
    const target = targetName || (resourceId ? `#${resourceId}` : '');
    const fieldText = changedFields.length > 0 ? ` 변경 필드: ${changedFields.join(', ')}` : '';

    return `${resourceLabel} ${label}${target ? `: ${target}` : ''}${fieldText}`;
};

/**
 * @description 성공한 관리자 변경 작업을 DB 감사 로그에 기록한다.
 * @param {string} action 액션 코드
 * @returns {Function} Express 미들웨어
 */
const logActivity = (action) => {
    return (req, res, next) => {
        res.on('finish', () => {
            if (res.statusCode >= 400 || !req.admin) {
                return;
            }

            setImmediate(async () => {
                try {
                    const resourceType = inferResourceType(req);
                    const resourceId = getResourceId(req);
                    const details = buildActivityDetails(action, req, resourceType, resourceId);

                    await AdminActivityLogs.log(
                        req.admin.id,
                        action,
                        resourceType,
                        resourceId,
                        details,
                        getClientIp(req),
                        summarizeUserAgent(req.headers['user-agent'])
                    );
                } catch (error) {
                    logger.error('활동 로그 기록 실패', {
                        requestId: req.requestId,
                        action,
                        error: error.message,
                        stack: error.stack
                    });
                }
            });
        });

        next();
    };
};

/**
 * @description 인증을 지정된 IP로 제한한다.
  * @param {*} allowedIPs 입력값
 * @returns {any} 처리 결과
 */
const restrictToIPs = (allowedIPs) => {
    return (req, res, next) => {
        const clientIP = req.ip || req.connection.remoteAddress;
        
        if (!allowedIPs.includes(clientIP)) {
            logger.warn('IP 접근 차단', {
                requestId: req.requestId,
                ip: clientIP
            });

            return res.status(403).json({
                success: false,
                message: '허용되지 않은 IP 주소입니다.'
            });
        }

        next();
    };
};

const adminOnly = [authenticateToken, requireRole(['super_admin', 'admin'])];
const superAdminOnly = [authenticateToken, requireRole('super_admin')];

module.exports = {
    authenticateToken,
    requirePermission,
    requireRole,
    logActivity,
    restrictToIPs,
    adminOnly,
    superAdminOnly
};
