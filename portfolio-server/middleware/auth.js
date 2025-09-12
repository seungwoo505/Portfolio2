const AdminUsers = require('../models/admin-users');
const AdminActivityLogs = require('../models/admin-activity-logs');
const logger = require('../log');

// JWT 토큰 검증 미들웨어 (자동 재발급 포함)
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
            // JWT 토큰 검증
        const decoded = AdminUsers.verifyToken(token);
        
            // IP 주소 검증 (보안 강화)
            const clientIP = req.ip || req.connection.remoteAddress;
            if (decoded.ip && decoded.ip !== clientIP) {
                return res.status(401).json({
                    success: false,
                    message: '토큰이 다른 IP에서 발급되었습니다.'
                });
            }
            
            // 사용자 활성 상태 확인
            const user = await AdminUsers.getById(decoded.id);
            if (!user || !user.is_active) {
            return res.status(401).json({
                success: false,
                    message: '비활성화된 사용자입니다.'
            });
        }

        // req 객체에 사용자 정보 추가
        req.admin = {
            id: decoded.id,
            username: decoded.username,
            role: decoded.role
        };

        next();
        } catch (tokenError) {
            // Access Token이 만료된 경우 Refresh Token으로 재발급 시도
            if (refreshToken) {
                try {
                    const refreshDecoded = AdminUsers.verifyRefreshToken(refreshToken);
                    
                    // IP 주소 검증
                    const clientIP = req.ip || req.connection.remoteAddress;
                    if (refreshDecoded.ip && refreshDecoded.ip !== clientIP) {
                        return res.status(401).json({
                            success: false,
                            message: 'Refresh Token이 다른 IP에서 발급되었습니다.'
                        });
                    }

                    // 사용자 정보 조회
                    const user = await AdminUsers.getById(refreshDecoded.id);
                    if (!user || !user.is_active) {
                        return res.status(401).json({
                            success: false,
                            message: '비활성화된 사용자입니다.'
                        });
                    }

                    // 새로운 Access Token 생성
                    const newToken = AdminUsers.generateToken(user, clientIP);
                    
                    // req 객체에 사용자 정보 추가
                    req.admin = {
                        id: user.id,
                        username: user.username,
                        role: user.role
                    };

                    // 응답 헤더에 새로운 토큰 추가
                    res.setHeader('X-New-Token', newToken);
                    
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

// 권한 확인 미들웨어
const requirePermission = (permissionName) => {
    return async (req, res, next) => {
        try {
            if (!req.admin) {
                return res.status(401).json({
                    success: false,
                    message: '인증이 필요합니다.'
                });
            }

            // super_admin은 모든 권한 보유
            if (req.admin.role === 'super_admin') {
                return next();
            }

            // 권한 확인
            const hasPermission = await AdminUsers.hasPermission(req.admin.id, permissionName);
            
            if (!hasPermission) {
                return res.status(403).json({
                    success: false,
                    message: '권한이 부족합니다.',
                    required_permission: permissionName
                });
            }

            next();
        } catch (error) {
            return res.status(500).json({
                success: false,
                message: '권한 확인 중 오류가 발생했습니다.',
                error: error.message
            });
        }
    };
};

// 역할 기반 접근 제어
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
            return res.status(403).json({
                success: false,
                message: '접근 권한이 부족합니다.',
                required_roles: allowedRoles,
                current_role: req.admin.role
            });
        }

        next();
    };
};

// 활동 로그 기록 미들웨어
const logActivity = (action) => {
    return async (req, res, next) => {
        // 원본 응답 메서드 저장
        const originalSend = res.send;
        
        // 응답 메서드 오버라이드
        res.send = function(data) {
            // 성공적인 응답인 경우에만 로그 기록
            if (res.statusCode < 400 && req.admin) {
                // 비동기로 로그 기록 (응답 속도에 영향 없도록)
                setImmediate(async () => {
                    try {
                        let resourceType = req.baseUrl.split('/').pop(); // URL에서 리소스 타입 추출
                        
                        // 리소스 타입을 한글로 변환
                        const resourceTypeMap = {
                            'admin': '사용자',
                            'users': '사용자',
                            'projects': '프로젝트',
                            'blog': '블로그',
                            'posts': '블로그',
                            'tags': '태그',
                            'contacts': '연락처',
                            'settings': '설정',
                            'images': '이미지',
                            'uploads': '파일',
                            'skills': '기술 스택'
                        };
                        
                        resourceType = resourceTypeMap[resourceType] || resourceType;
                        const resourceId = req.params.id || req.body.id;
                        
                        // IP 주소 정리 (::ffff: 접두사 제거)
                        let cleanIp = req.ip || req.connection.remoteAddress;
                        if (cleanIp && cleanIp.startsWith('::ffff:')) {
                            cleanIp = cleanIp.substring(7);
                        }
                        
                        // User Agent 간략하게 처리
                        let cleanUserAgent = req.headers['user-agent'] || '';
                        if (cleanUserAgent) {
                            try {
                                // OS 정보 추출
                                let os = 'Unknown';
                                if (cleanUserAgent.includes('Windows')) {
                                    if (cleanUserAgent.includes('Windows NT 10.0')) os = 'Windows 10/11';
                                    else if (cleanUserAgent.includes('Windows NT 6.3')) os = 'Windows 8.1';
                                    else if (cleanUserAgent.includes('Windows NT 6.2')) os = 'Windows 8';
                                    else if (cleanUserAgent.includes('Windows NT 6.1')) os = 'Windows 7';
                                    else os = 'Windows';
                                } else if (cleanUserAgent.includes('Macintosh')) {
                                    if (cleanUserAgent.includes('Mac OS X 10_15')) os = 'macOS 10.15';
                                    else if (cleanUserAgent.includes('Mac OS X 11_')) os = 'macOS 11';
                                    else if (cleanUserAgent.includes('Mac OS X 12_')) os = 'macOS 12';
                                    else if (cleanUserAgent.includes('Mac OS X 13_')) os = 'macOS 13';
                                    else if (cleanUserAgent.includes('Mac OS X 14_')) os = 'macOS 14';
                                    else os = 'macOS';
                                } else if (cleanUserAgent.includes('Linux')) {
                                    if (cleanUserAgent.includes('Android')) {
                                        const androidVersion = cleanUserAgent.match(/Android (\d+)/);
                                        os = androidVersion ? `Android ${androidVersion[1]}` : 'Android';
                                    } else {
                                        os = 'Linux';
                                    }
                                } else if (cleanUserAgent.includes('iPhone')) {
                                    const iosVersion = cleanUserAgent.match(/OS (\d+)_/);
                                    os = iosVersion ? `iOS ${iosVersion[1]}` : 'iOS';
                                } else if (cleanUserAgent.includes('iPad')) {
                                    const iosVersion = cleanUserAgent.match(/OS (\d+)_/);
                                    os = iosVersion ? `iPadOS ${iosVersion[1]}` : 'iPadOS';
                                }
                                
                                // 브라우저 정보 추출
                                let browser = 'Unknown';
                                if (cleanUserAgent.includes('Chrome')) {
                                    const chromeVersion = cleanUserAgent.match(/Chrome\/(\d+)/);
                                    browser = chromeVersion ? `Chrome ${chromeVersion[1]}` : 'Chrome';
                                } else if (cleanUserAgent.includes('Firefox')) {
                                    const firefoxVersion = cleanUserAgent.match(/Firefox\/(\d+)/);
                                    browser = firefoxVersion ? `Firefox ${firefoxVersion[1]}` : 'Firefox';
                                } else if (cleanUserAgent.includes('Safari') && !cleanUserAgent.includes('Chrome')) {
                                    const safariVersion = cleanUserAgent.match(/Version\/(\d+)/);
                                    browser = safariVersion ? `Safari ${safariVersion[1]}` : 'Safari';
                                } else if (cleanUserAgent.includes('Edge')) {
                                    const edgeVersion = cleanUserAgent.match(/Edge\/(\d+)/);
                                    browser = edgeVersion ? `Edge ${edgeVersion[1]}` : 'Edge';
                                } else if (cleanUserAgent.includes('Opera')) {
                                    const operaVersion = cleanUserAgent.match(/Opera\/(\d+)/);
                                    browser = operaVersion ? `Opera ${operaVersion[1]}` : 'Opera';
                                }
                                
                                cleanUserAgent = `${os} | ${browser}`;
                            } catch (error) {
                                // 파싱 실패 시 원본 사용
                                if (cleanUserAgent.length > 50) {
                                    cleanUserAgent = cleanUserAgent.substring(0, 50) + '...';
                                }
                            }
                        }
                        
                        // 액션명을 한글로 변환하는 함수
                        const getActionKoreanName = (actionName) => {
                            const actionMap = {
                                // 인증 관련
                                'admin_login': '로그인',
                                'admin_login_failed': '로그인 실패',
                                'admin_logout': '로그아웃',
                                'change_password': '비밀번호 변경',
                                'view_profile': '프로필 조회',
                                
                                // 대시보드
                                'view_dashboard': '대시보드',
                                'view_activity_logs': '로그 조회',
                                
                                // 블로그 관련
                                'create_blog_post': '블로그 생성',
                                'update_blog_post': '블로그 수정',
                                'delete_blog_post': '블로그 삭제',
                                'publish_blog_post': '블로그 발행',
                                'view_blog_posts': '블로그 목록',
                                
                                // 프로젝트 관련
                                'create_project': '프로젝트 생성',
                                'update_project': '프로젝트 수정',
                                'delete_project': '프로젝트 삭제',
                                'view_projects': '프로젝트 목록',
                                'view_project_detail': '프로젝트 상세',
                                
                                // 태그 관련
                                'create_tag': '태그 생성',
                                'update_tag': '태그 수정',
                                'delete_tag': '태그 삭제',
                                'view_tags': '태그 목록',
                                
                                // 사용자 관련
                                'create_admin': '관리자 생성',
                                'update_admin': '관리자 수정',
                                'delete_admin': '관리자 삭제',
                                'create_user': '사용자 생성',
                                'update_user': '사용자 수정',
                                'delete_user': '사용자 삭제',
                                
                                // 연락처 관련
                                'view_contacts': '연락처 조회',
                                'mark_contact_read': '연락처 읽음',
                                'mark_contact_unread': '연락처 읽지 않음',
                                
                                // 이미지 관련
                                'upload_image': '이미지 업로드',
                                'delete_image': '이미지 삭제',
                                
                                // 설정 관련
                                'update_settings': '설정 수정'
                            };
                            
                            return actionMap[actionName] || actionName.replace(/_/g, ' ');
                        };
                        
                        // 깔끔한 텍스트로 활동 로그 생성
                        let activityDetails = '';
                        
                        // 액션과 리소스 타입에 따른 상세 정보 생성
                        if (action) {
                            // 특정 액션이 지정된 경우
                            if (action === 'view_activity_logs') {
                                activityDetails = '활동 로그 조회';
                            } else if (action === 'create_blog_post') {
                                activityDetails = '새 블로그 포스트 생성';
                            } else if (action === 'update_blog_post') {
                                const postTitle = req.body.title || `#${resourceId}`;
                                let changeDetails = [];
                                
                                // 제목 변경 확인
                                if (req.body.title) {
                                    changeDetails.push('제목');
                                }
                                
                                // 내용 변경 확인
                                if (req.body.content) {
                                    changeDetails.push('내용');
                                }
                                
                                // 발행 상태 변경 확인
                                if (req.body.is_published !== undefined) {
                                    changeDetails.push(req.body.is_published ? '공개로 변경' : '비공개로 변경');
                                }
                                
                                // 태그 변경 확인
                                if (req.body.tags) {
                                    changeDetails.push('태그');
                                }
                                
                                // 메타 정보 변경 확인
                                if (req.body.meta_description || req.body.meta_keywords) {
                                    changeDetails.push('메타 정보');
                                }
                                
                                // 변경된 내용이 있으면 상세하게 표시
                                if (changeDetails.length > 0) {
                                    activityDetails = `블로그 포스트 수정: ${postTitle} (${changeDetails.join(', ')})`;
                                } else {
                                    activityDetails = `블로그 포스트 수정: ${postTitle}`;
                                }
                            } else if (action === 'delete_blog_post') {
                                const postTitle = req.body.title || `#${resourceId}`;
                                activityDetails = `블로그 포스트 삭제: ${postTitle}`;
                            } else if (action === 'view_blog_posts') {
                                activityDetails = '블로그 포스트 목록 조회';
                            } else if (action === 'view_projects') {
                                activityDetails = '프로젝트 목록 조회';
                            } else if (action === 'view_project_detail') {
                                activityDetails = '프로젝트 상세 조회';
                            } else if (action === 'view_contacts') {
                                activityDetails = '연락처 메시지 조회';
                            } else if (action === 'view_tags') {
                                activityDetails = '태그 목록 조회';
                            } else if (action === 'view_dashboard') {
                                activityDetails = '대시보드 조회';
                            } else if (action === 'view_profile') {
                                const username = req.admin.username || '알 수 없음';
                                activityDetails = `${username} 프로필 정보 조회`;
                            } else if (action === 'view_settings') {
                                activityDetails = '사이트 설정 조회';
                            } else if (action === 'create_project') {
                                activityDetails = '새 프로젝트 생성';
                            } else if (action === 'update_project') {
                                const projectTitle = req.body.title || `#${resourceId}`;
                                let changeDetails = [];
                                
                                // 제목 변경 확인
                                if (req.body.title) {
                                    changeDetails.push('제목');
                                }
                                
                                // 설명 변경 확인
                                if (req.body.description) {
                                    changeDetails.push('설명');
                                }
                                
                                // 기술 스택 변경 확인
                                if (req.body.tech_stack) {
                                    changeDetails.push('기술 스택');
                                }
                                
                                // 링크 변경 확인
                                if (req.body.github_url || req.body.live_url) {
                                    changeDetails.push('링크');
                                }
                                
                                // 대표 프로젝트 설정 변경 확인
                                if (req.body.is_featured !== undefined) {
                                    changeDetails.push(req.body.is_featured ? '대표 프로젝트로 설정' : '대표 프로젝트 해제');
                                }
                                
                                // 변경된 내용이 있으면 상세하게 표시
                                if (changeDetails.length > 0) {
                                    activityDetails = `프로젝트 수정: ${projectTitle} (${changeDetails.join(', ')})`;
                                } else {
                                    activityDetails = `프로젝트 수정: ${projectTitle}`;
                                }
                            } else if (action === 'delete_project') {
                                const projectTitle = req.body.title || `#${resourceId}`;
                                activityDetails = `프로젝트 삭제: ${projectTitle}`;
                            } else if (action === 'create_tag') {
                                const tagName = req.body.name || '이름 없음';
                                activityDetails = `새 태그 생성: ${tagName}`;
                            } else if (action === 'update_tag') {
                                const tagName = req.body.name || `#${resourceId}`;
                                let changeDetails = [];
                                
                                // 태그 이름 변경 확인
                                if (req.body.name) {
                                    changeDetails.push('이름');
                                }
                                
                                // 설명 변경 확인
                                if (req.body.description) {
                                    changeDetails.push('설명');
                                }
                                
                                // 색상 변경 확인
                                if (req.body.color) {
                                    changeDetails.push('색상');
                                }
                                
                                // 타입 변경 확인
                                if (req.body.type) {
                                    changeDetails.push(`타입: ${req.body.type}`);
                                }
                                
                                // 변경된 내용이 있으면 상세하게 표시
                                if (changeDetails.length > 0) {
                                    activityDetails = `태그 수정: ${tagName} (${changeDetails.join(', ')})`;
                                } else {
                                    activityDetails = `태그 수정: ${tagName}`;
                                }
                            } else if (action === 'delete_tag') {
                                const tagName = req.body.name || `#${resourceId}`;
                                activityDetails = `태그 삭제: ${tagName}`;
                            } else if (action === 'create_user') {
                                const username = req.body.username || '사용자명 없음';
                                activityDetails = `새 사용자 생성: ${username}`;
                            } else if (action === 'update_user') {
                                const username = req.body.username || `#${resourceId}`;
                                let changeDetails = [];
                                
                                // 사용자명 변경 확인
                                if (req.body.username) {
                                    changeDetails.push('사용자명');
                                }
                                
                                // 이메일 변경 확인
                                if (req.body.email) {
                                    changeDetails.push('이메일');
                                }
                                
                                // 전체 이름 변경 확인
                                if (req.body.full_name) {
                                    changeDetails.push('전체 이름');
                                }
                                
                                // 역할 변경 확인
                                if (req.body.role) {
                                    changeDetails.push(`역할: ${req.body.role}`);
                                }
                                
                                // 변경된 내용이 있으면 상세하게 표시
                                if (changeDetails.length > 0) {
                                    activityDetails = `사용자 정보 수정: ${username} (${changeDetails.join(', ')})`;
                                } else {
                                    activityDetails = `사용자 정보 수정: ${username}`;
                                }
                            } else if (action === 'delete_user') {
                                const username = req.body.username || `#${resourceId}`;
                                activityDetails = `사용자 삭제: ${username}`;
                            } else if (action === 'mark_contact_read') {
                                activityDetails = `연락처 #${resourceId} 읽음 처리`;
                            } else if (action === 'mark_contact_unread') {
                                activityDetails = `연락처 #${resourceId} 읽지 않음 처리`;
                            } else {
                                // 기본 액션 처리
                                activityDetails = `${action.replace(/_/g, ' ')}`;
                            }
                        } else {
                            // 액션이 지정되지 않은 경우 HTTP 메서드와 리소스 타입으로 생성
                            const method = req.method.toLowerCase();
                            if (method === 'post') {
                                activityDetails = `새 ${resourceType} 생성`;
                            } else if (method === 'put' || method === 'patch') {
                                activityDetails = `${resourceType} 수정: #${resourceId || 'ID 없음'}`;
                            } else if (method === 'delete') {
                                activityDetails = `${resourceType} 삭제: #${resourceId || 'ID 없음'}`;
                            } else if (method === 'get') {
                                activityDetails = `${resourceType} 조회: #${resourceId || 'ID 없음'}`;
                            } else {
                                activityDetails = `${method} ${resourceType}`;
                            }
                        }

                        // 액션명을 한글로 변환
                        const koreanActionName = getActionKoreanName(action || `${req.method.toLowerCase()}_${resourceType}`);

                        await AdminActivityLogs.log(
                            req.admin.id,
                            koreanActionName,  // 한글 액션명 사용
                            resourceType,
                            resourceId,
                            activityDetails,  // JSON 대신 깔끔한 텍스트 전달
                            cleanIp, // 정리된 IP 주소 사용
                            cleanUserAgent // 정리된 User Agent 사용
                        );
                    } catch (error) {
                        logger.error('Activity logging error', { error: error.message, stack: error.stack });
                    }
                });
            }
            
            // 원본 응답 메서드 호출
            originalSend.call(this, data);
        };

        next();
    };
};

// IP 기반 접근 제한 (선택사항)
const restrictToIPs = (allowedIPs) => {
    return (req, res, next) => {
        const clientIP = req.ip || req.connection.remoteAddress;
        
        if (!allowedIPs.includes(clientIP)) {
            return res.status(403).json({
                success: false,
                message: '허용되지 않은 IP 주소입니다.',
                ip: clientIP
            });
        }

        next();
    };
};

// 관리자 전용 라우트를 위한 조합 미들웨어
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
