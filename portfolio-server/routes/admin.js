/**
 * @swagger
 * components:
 *   securitySchemes:
 *     bearerAuth:
 *       type: http
 *       scheme: bearer
 *       bearerFormat: JWT
 *   schemas:
 *     LoginRequest:
 *       type: object
 *       required:
 *         - username
 *         - password
 *       properties:
 *         username:
 *           type: string
 *           example: "admin"
 *         password:
 *           type: string
 *           example: "password123"
 *     LoginResponse:
 *       type: object
 *       properties:
 *         success:
 *           type: boolean
 *           example: true
 *         token:
 *           type: string
 *           example: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
 *         refreshToken:
 *           type: string
 *           example: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
 *         user:
 *           type: object
 *           properties:
 *             id:
 *               type: integer
 *               example: 1
 *             username:
 *               type: string
 *               example: "admin"
 *             role:
 *               type: string
 *               example: "super_admin"
 *     ErrorResponse:
 *       type: object
 *       properties:
 *         success:
 *           type: boolean
 *           example: false
 *         message:
 *           type: string
 *           example: "에러 메시지"
 *     DashboardStats:
 *       type: object
 *       properties:
 *         blogPosts:
 *           type: object
 *           properties:
 *             total:
 *               type: integer
 *               example: 25
 *             published:
 *               type: integer
 *               example: 20
 *             drafts:
 *               type: integer
 *               example: 5
 *         projects:
 *           type: object
 *           properties:
 *             total:
 *               type: integer
 *               example: 12
 *             featured:
 *               type: integer
 *               example: 8
 *         contactMessages:
 *           type: integer
 *           example: 45
 *         adminActivity:
 *           type: integer
 *           example: 156
 */

const express = require('express');
const router = express.Router();
const logger = require('../log');
const isVerboseLogsEnabled = process.env.ENABLE_VERBOSE_LOGS === 'true';
const verboseDebug = (...args) => {
    if (isVerboseLogsEnabled) {
        logger.debug(...args);
    }
};

const AdminUsers = require('../models/admin-users');
const AdminActivityLogs = require('../models/admin-activity-logs');
const BlogPosts = require('../models/blog-posts');
const Projects = require('../models/projects');
const ContactMessages = require('../models/contact-messages');
const SiteSettings = require('../models/site-settings');
const Tags = require('../models/tags');
const { executeQuery } = require('../models/db-utils');

const {
    authenticateToken,
    requirePermission,
    requireRole,
    logActivity,
    adminOnly,
    superAdminOnly
} = require('../middleware/auth');


/**
 * @swagger
 * /api/admin/login:
 *   post:
 *     summary: 관리자 로그인
 *     description: 관리자 계정으로 로그인하여 JWT 토큰을 발급받습니다.
 *     tags: [Authentication]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/LoginRequest'
 *     responses:
 *       200:
 *         description: 로그인 성공
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/LoginResponse'
 *       401:
 *         description: 인증 실패
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       429:
 *         description: 너무 많은 로그인 시도
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.post('/login', async (req, res) => {
    try {
        const { username, password } = req.body;

        if (!username || !password) {
            return res.status(400).json({
                success: false,
                message: '사용자명과 비밀번호를 입력해주세요.'
            });
        }

        const result = await AdminUsers.login(
            username,
            password,
            req.ip,
            req.headers['user-agent']
        );

        await AdminActivityLogs.log(
            result.user.id,
            '회원',
            '인증',
            null,
            `${username} 로그인`,
            req.ip,
            req.headers['user-agent']
        );

        logger.activity('관리자 로그인 성공', {
            username,
            ip: req.ip,
            userAgent: req.headers['user-agent'],
            loginTime: new Date().toISOString()
        }, result.user);
        
        logger.incrementCounter('loginSuccess');

        res.json({
            success: true,
            message: '로그인되었습니다.',
            data: result
        });
    } catch (error) {
        await AdminActivityLogs.log(
            null,
            '회원',
            '인증',
            null,
            `${req.body.username} 로그인 실패`,
            req.ip,
            req.headers['user-agent']
        );

        logger.activity('관리자 로그인 실패', {
            username: req.body.username,
            ip: req.ip,
            userAgent: req.headers['user-agent'],
            error: error.message,
            attemptTime: new Date().toISOString()
        });

        res.status(401).json({
            success: false,
            message: error.message
        });
    }
});

router.post('/logout', authenticateToken, async (req, res) => {
    try {
        const token = req.headers['authorization'].split(' ')[1];
        await AdminUsers.logout(token);

        await AdminActivityLogs.log(
            req.admin.id,
            '회원',
            '인증',
            null,
            '로그아웃',
            req.ip,
            req.headers['user-agent']
        );

        logger.activity('관리자 로그아웃', {
            username: req.admin.username,
            ip: req.ip,
            userAgent: req.headers['user-agent'],
            logoutTime: new Date().toISOString()
        }, req.admin);

        res.json({
            success: true,
            message: '로그아웃되었습니다.'
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: '로그아웃 중 오류가 발생했습니다.'
        });
    }
});

router.post('/refresh', async (req, res) => {
    try {
        const { refreshToken } = req.body;

        if (!refreshToken) {
            return res.status(400).json({
                success: false,
                message: 'Refresh Token이 필요합니다.'
            });
        }

        const decoded = AdminUsers.verifyRefreshToken(refreshToken);
        
        const clientIP = req.ip || req.connection.remoteAddress;
        if (decoded.ip && decoded.ip !== clientIP) {
            return res.status(401).json({
                success: false,
                message: 'Refresh Token이 다른 IP에서 발급되었습니다.'
            });
        }

        const user = await AdminUsers.getById(decoded.id);
        if (!user || !user.is_active) {
            return res.status(401).json({
                success: false,
                message: '비활성화된 사용자입니다.'
            });
        }

        const newToken = AdminUsers.generateToken(user, clientIP);

        res.json({
            success: true,
            message: '토큰이 재발급되었습니다.',
            data: {
                token: newToken
            }
        });
    } catch (error) {
        res.status(401).json({
            success: false,
            message: error.message
        });
    }
});

router.get('/me', authenticateToken, async (req, res) => {
    try {
        const user = await AdminUsers.getById(req.admin.id);
        const permissions = await AdminUsers.getUserPermissions(req.admin.id);

        res.json({
            success: true,
            data: {
                user,
                permissions
            }
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: '사용자 정보를 가져오는데 실패했습니다.'
        });
    }
});

router.put('/password', authenticateToken, logActivity('change_password'), async (req, res) => {
    try {
        const { oldPassword, newPassword } = req.body;

        if (!oldPassword || !newPassword) {
            return res.status(400).json({
                success: false,
                message: '기존 비밀번호와 새 비밀번호를 입력해주세요.'
            });
        }

        if (newPassword.length < 6) {
            return res.status(400).json({
                success: false,
                message: '새 비밀번호는 최소 6자 이상이어야 합니다.'
            });
        }

        await AdminUsers.changePassword(req.admin.id, oldPassword, newPassword);

        res.json({
            success: true,
            message: '비밀번호가 변경되었습니다.'
        });
    } catch (error) {
        res.status(400).json({
            success: false,
            message: error.message
        });
    }
});


router.get('/users', ...superAdminOnly, async (req, res) => {
    try {
        const users = await AdminUsers.getAll();
        res.json({
            success: true,
            data: users
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: '관리자 목록을 가져오는데 실패했습니다.'
        });
    }
});

router.post('/users', ...superAdminOnly, logActivity('create_admin'), async (req, res) => {
    try {
        const { username, email, password, full_name, role } = req.body;

        if (!username || !email || !password) {
            return res.status(400).json({
                success: false,
                message: '사용자명, 이메일, 비밀번호는 필수입니다.'
            });
        }

        const id = await AdminUsers.create({
            username,
            email,
            password,
            full_name,
            role
        });

        const newUser = await AdminUsers.getById(id);

        res.status(201).json({
            success: true,
            message: '관리자가 생성되었습니다.',
            data: newUser
        });
    } catch (error) {
        res.status(400).json({
            success: false,
            message: error.message
        });
    }
});

router.put('/users/:id', ...superAdminOnly, logActivity('update_admin'), async (req, res) => {
    try {
        const updatedUser = await AdminUsers.update(req.params.id, req.body);

        res.json({
            success: true,
            message: '관리자 정보가 수정되었습니다.',
            data: updatedUser
        });
    } catch (error) {
        logger.error('사용자 정보 수정 실패', {
            userId: req.params.id,
            error: error.message,
            requestBody: req.body
        });

        res.status(500).json({
            success: false,
            message: '관리자 정보 수정에 실패했습니다.'
        });
    }
});

router.delete('/users/:id', ...superAdminOnly, logActivity('delete_admin'), async (req, res) => {
    try {
        const userId = req.params.id;

        if (userId === req.admin.id.toString()) {
            return res.status(400).json({
                success: false,
                message: '자신의 계정은 삭제할 수 없습니다.'
            });
        }

        const userToDelete = await AdminUsers.getById(userId);
        if (!userToDelete) {
            return res.status(404).json({
                success: false,
                message: '삭제할 사용자를 찾을 수 없습니다.'
            });
        }

        await AdminUsers.delete(userId);

        res.json({
            success: true,
            message: '관리자가 삭제되었습니다.'
        });
    } catch (error) {
        logger.error('사용자 삭제 실패:', {
            userId: req.params.id,
            error: error.message
        });

        res.status(500).json({
            success: false,
            message: '관리자 삭제에 실패했습니다.'
        });
    }
});


router.get('/projects', authenticateToken, requirePermission('projects.read'), async (req, res) => {
    try {
        const { limit, page, featured } = req.query;
        const pageLimit = parseInt(limit) || 20;
        const offset = page ? (parseInt(page) - 1) * pageLimit : 0;

        let projects;
        if (featured === 'true') {
            projects = await Projects.getFeatured();
        } else {
            projects = await Projects.getAll(pageLimit, offset);
        }

        res.json({
            success: true,
            data: projects,
            pagination: {
                page: parseInt(page) || 1,
                limit: pageLimit,
                total: projects.length
            }
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: '프로젝트를 가져오는데 실패했습니다.'
        });
    }
});

router.post('/projects', authenticateToken, requirePermission('projects.create'), logActivity('create_project'), async (req, res) => {
    try {
        const id = await Projects.create(req.body);
        const newProject = await Projects.getById(id);

        res.status(201).json({
            success: true,
            message: '프로젝트가 생성되었습니다.',
            data: newProject
        });
    } catch (error) {
        res.status(400).json({
            success: false,
            message: error.message
        });
    }
});



/**
 * @swagger
 * /api/admin/dashboard:
 *   get:
 *     summary: 관리자 대시보드 통계
 *     description: 블로그, 프로젝트, 연락처 메시지, 관리자 활동 등의 통계 정보를 조회합니다.
 *     tags: [Dashboard]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: 대시보드 통계 조회 성공
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   $ref: '#/components/schemas/DashboardStats'
 *       401:
 *         description: 인증되지 않음
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       403:
 *         description: 권한 없음
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.get('/dashboard', authenticateToken, requirePermission('dashboard.read'), async (req, res) => {
    try {
        const [
            blogStats,
            projectStats,
            contactStats,
            activityStats
        ] = await Promise.all([
            executeQuery(`
                SELECT 
                    COUNT(*) as total,
                    SUM(CASE WHEN is_published = 1 THEN 1 ELSE 0 END) as published,
                    SUM(CASE WHEN is_published = 0 THEN 1 ELSE 0 END) as drafts
                FROM blog_posts
            `).then(result => ({
                total: result[0].total,
                published: result[0].published,
                drafts: result[0].drafts
            })),
            executeQuery(`
                SELECT
                    COUNT(*) as total,
                    SUM(CASE WHEN is_featured = 1 THEN 1 ELSE 0 END) as featured
                FROM projects
            `).then(result => ({
                total: result[0].total,
                featured: result[0].featured
            })),
            ContactMessages.getStats(),
            AdminActivityLogs.getStats(7) // 7일간 활동
        ]);

        res.json({
            success: true,
            data: {
                blog: blogStats,
                projects: projectStats,
                contacts: contactStats,
                activities: activityStats
            }
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: '대시보드 데이터를 가져오는데 실패했습니다.'
        });
    }
});


router.get('/blog/posts', authenticateToken, requirePermission('blog.read'), async (req, res) => {
    try {
        const { limit, page, status } = req.query;
        const pageLimit = parseInt(limit) || 20;
        const offset = page ? (parseInt(page) - 1) * pageLimit : 0;

        const posts = await BlogPosts.getAll(pageLimit, offset, false);

        res.json({
            success: true,
            data: posts,
            pagination: {
                page: parseInt(page) || 1,
                limit: pageLimit,
                total: posts.length
            }
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: '블로그 포스트를 가져오는데 실패했습니다.'
        });
    }
});

router.get('/blog/posts/slug/:slug', authenticateToken, requirePermission('blog.read'), async (req, res) => {
    try {
        const post = await BlogPosts.getBySlugAdmin(req.params.slug);

        if (!post) {
            return res.status(404).json({
                success: false,
                message: '포스트를 찾을 수 없습니다.'
            });
        }

        res.json({
            success: true,
            data: post
        });
    } catch (error) {
        logger.error('Blog post fetch error:', error);
        res.status(500).json({
            success: false,
            message: '포스트 정보를 가져오는데 실패했습니다.'
        });
    }
});

router.put('/blog/posts/slug/:slug',
    authenticateToken,
    requirePermission('blog.update'),
    logActivity('update_blog_post'),
    async (req, res) => {
        try {
            const postSlug = req.params.slug;

            const existingPost = await BlogPosts.getBySlugAdmin(postSlug);
            if (!existingPost) {
                return res.status(404).json({
                    success: false,
                    message: '포스트를 찾을 수 없습니다.'
                });
            }

            const updatedPost = await BlogPosts.update(existingPost.id, req.body);

            res.json({
                success: true,
                message: '블로그 포스트가 수정되었습니다.',
                data: updatedPost
            });
        } catch (error) {
            logger.error('Blog post update error:', error);
            res.status(500).json({
                success: false,
                message: '블로그 포스트 수정에 실패했습니다.'
            });
        }
    }
);

router.put('/blog/posts/slug/:slug/publish',
    authenticateToken,
    requirePermission('blog.publish'),
    logActivity('publish_blog_post'),
    async (req, res) => {
        try {
            const { is_published } = req.body;
            const postSlug = req.params.slug;

            const existingPost = await BlogPosts.getBySlugAdmin(postSlug);
            if (!existingPost) {
                return res.status(404).json({
                    success: false,
                    message: '포스트를 찾을 수 없습니다.'
                });
            }

            const updatedPost = await BlogPosts.update(existingPost.id, {
                is_published: is_published
            });

            res.json({
                success: true,
                message: is_published ? '포스트가 발행되었습니다.' : '포스트 발행이 취소되었습니다.',
                data: updatedPost
            });
        } catch (error) {
            res.status(500).json({
                success: false,
                message: '포스트 발행 상태 변경에 실패했습니다.'
            });
        }
    }
);

router.put('/blog/posts/slug/:slug/featured',
    authenticateToken,
    requirePermission('blog.edit'),
    logActivity('feature_blog_post'),
    async (req, res) => {
        try {
            const { is_featured } = req.body;
            const postSlug = req.params.slug;

            const existingPost = await BlogPosts.getBySlugAdmin(postSlug);
            if (!existingPost) {
                return res.status(404).json({
                    success: false,
                    message: '포스트를 찾을 수 없습니다.'
                });
            }

            const updatedPost = await BlogPosts.update(existingPost.id, {
                is_featured: is_featured
            });

            res.json({
                success: true,
                message: is_featured ? '포스트가 추천되었습니다.' : '포스트 추천이 해제되었습니다.',
                data: updatedPost
            });
        } catch (error) {
            logger.error('Blog post featured toggle error:', error);
            res.status(500).json({
                success: false,
                message: '포스트 추천 상태 변경에 실패했습니다.'
            });
        }
    }
);

router.delete('/blog/posts/slug/:slug',
    authenticateToken,
    requirePermission('blog.delete'),
    logActivity('delete_blog_post'),
    async (req, res) => {
        try {
            const postSlug = req.params.slug;

            const post = await BlogPosts.getBySlugAdmin(postSlug);
            if (!post) {
                return res.status(404).json({
                    success: false,
                    message: '포스트를 찾을 수 없습니다.'
                });
            }

            await BlogPosts.delete(post.id);

            res.json({
                success: true,
                message: '블로그 포스트가 삭제되었습니다.'
            });
        } catch (error) {
            logger.error('Blog post deletion error:', error);
            res.status(500).json({
                success: false,
                message: '블로그 포스트 삭제에 실패했습니다.'
            });
        }
    }
);


router.get('/projects', authenticateToken, requirePermission('projects.read'), async (req, res) => {
    try {
        const { limit, page, status } = req.query;
        const pageLimit = parseInt(limit) || 20;
        const offset = page ? (parseInt(page) - 1) * pageLimit : 0;

        const projects = await Projects.getAll(pageLimit, offset);

        res.json({
            success: true,
            data: projects,
            pagination: {
                page: parseInt(page) || 1,
                limit: pageLimit,
                total: projects.length
            }
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: '프로젝트를 가져오는데 실패했습니다.'
        });
    }
});

router.get('/projects/slug/:slug', authenticateToken, requirePermission('projects.read'), async (req, res) => {
    try {
        const project = await Projects.getBySlug(req.params.slug);

        if (!project) {
            return res.status(404).json({
                success: false,
                message: '프로젝트를 찾을 수 없습니다.'
            });
        }

        res.json({
            success: true,
            data: project
        });
    } catch (error) {
        logger.error('Project fetch error:', error);
        res.status(500).json({
            success: false,
            message: '프로젝트 정보를 가져오는데 실패했습니다.'
        });
    }
});

router.post('/projects',
    authenticateToken,
    requirePermission('projects.create'),
    logActivity('create_project'),
    async (req, res) => {
        try {
            const { title, description } = req.body;

            if (!title || !description) {
                return res.status(400).json({
                    success: false,
                    message: '제목과 설명은 필수입니다.'
                });
            }

            const sanitizedData = {};
            Object.keys(req.body).forEach(key => {
                if (req.body[key] === undefined) {
                    sanitizedData[key] = null;
                } else {
                    sanitizedData[key] = req.body[key];
                }
            });

            verboseDebug(원본 데이터:', req.body);
            verboseDebug(정규화된 데이터:', sanitizedData);
            verboseDebug(undefined 값이 있는지 확인:', Object.values(sanitizedData).some(v => v === undefined));

            const id = await Projects.create(sanitizedData);
            const newProject = await Projects.getById(id);

            res.status(201).json({
                success: true,
                message: '프로젝트가 생성되었습니다.',
                data: newProject
            });
        } catch (error) {
            logger.error('Project creation error:', error);
            res.status(500).json({
                success: false,
                message: '프로젝트 생성에 실패했습니다.'
            });
        }
    }
);

router.put('/projects/slug/:slug',
    authenticateToken, 
    requirePermission('projects.update'), 
    logActivity('update_project'),
    async (req, res) => {
        try {
            const projectSlug = req.params.slug;
            verboseDebug(projectSlug:', projectSlug);

            verboseDebug(Projects.getBySlug 호출 시작');
            const existingProject = await Projects.getBySlug(projectSlug);
            verboseDebug(Projects.getById 결과:', existingProject);
            if (!existingProject) {
                verboseDebug(프로젝트를 찾을 수 없음');
                return res.status(404).json({
                    success: false,
                    message: '프로젝트를 찾을 수 없습니다.'
                });
            }
            verboseDebug(프로젝트 존재 확인 완료');

            const sanitizedData = {};
            Object.keys(req.body).forEach(key => {
                if (req.body[key] === undefined) {
                    sanitizedData[key] = null;
                } else {
                    sanitizedData[key] = req.body[key];
                }
            });

            verboseDebug(프로젝트 수정 - 원본 데이터:', req.body);
            verboseDebug(프로젝트 수정 - 정규화된 데이터:', sanitizedData);
            verboseDebug(프로젝트 수정 - undefined 값이 있는지 확인:', Object.values(sanitizedData).some(v => v === undefined));

            verboseDebug(Projects.update 호출 시작');
            verboseDebug(projectSlug:', projectSlug);
            verboseDebug(sanitizedData:', sanitizedData);

            try {
                const updatedProject = await Projects.update(existingProject.id, sanitizedData);
                verboseDebug(Projects.update 성공:', updatedProject);

                res.json({
                    success: true,
                    message: '프로젝트가 수정되었습니다.',
                    data: updatedProject
                });
            } catch (updateError) {
                logger.error(Projects.update 실패:', updateError);
                logger.error(updateError.stack:', updateError.stack);
                throw updateError;
            }
        } catch (error) {
            logger.error('Project update error:', error);
            res.status(500).json({
                success: false,
                message: '프로젝트 수정에 실패했습니다.'
            });
        }
    }
);

router.delete('/projects/slug/:slug',
    authenticateToken,
    requirePermission('projects.delete'),
    logActivity('delete_project'),
    async (req, res) => {
        try {
            const projectSlug = req.params.slug;

            const project = await Projects.getBySlug(projectSlug);
            if (!project) {
                return res.status(404).json({
                    success: false,
                    message: '프로젝트를 찾을 수 없습니다.'
                });
            }

            await Projects.delete(project.id);

            res.json({
                success: true,
                message: '프로젝트가 삭제되었습니다.'
            });
        } catch (error) {
            logger.error('Project deletion error:', error);
            res.status(500).json({
                success: false,
                message: '프로젝트 삭제에 실패했습니다.'
            });
        }
    }
);

const geminiService = require('../services/gemini-ai');
verboseDebug(geminiService 객체 로드됨:', typeof geminiService);
verboseDebug(geminiService.constructor.name:', geminiService.constructor.name);
verboseDebug(geminiService.generateSummary 존재 여부:', typeof geminiService.generateSummary);
verboseDebug(geminiService 객체의 모든 메서드:', Object.getOwnPropertyNames(geminiService));
verboseDebug(geminiService 객체의 프로토타입 체인:', Object.getPrototypeOf(geminiService));

router.post('/ai/summarize',
    authenticateToken,
    requirePermission('blog.create'),
    async (req, res) => {
        try {
            const { content, includeKeywords = false, techTags = [] } = req.body;

            if (!content || content.trim().length < 1) {
                return res.status(400).json({
                    success: false,
                    message: '요약할 내용이 없습니다.'
                });
            }

            const preprocessedContent = content.replace(/__([^_]+)__/g, (match, projectName) => {
                verboseDebug(` 백엔드 전처리: ${match} → ${projectName} 프로젝트`);
                return `${projectName} 프로젝트`;
            });

            verboseDebug(원본 콘텐츠:', content);
            verboseDebug(전처리된 콘텐츠:', preprocessedContent);

            let result;

            if (includeKeywords) {
                result = await geminiService.generateSummaryAndKeywords(preprocessedContent, techTags);

                res.json({
                    success: true,
                    data: {
                        summary: result.summary,
                        keywords: result.keywords,
                        keywordsString: result.keywordsString,
                        originalLength: content.length,
                        summaryLength: result.summary.length
                    },
                    message: 'Gemini AI로 요약과 키워드가 생성되었습니다.'
                });
            } else {
                verboseDebug(AI 요약 생성 시작 - content 길이:', content.length);
                verboseDebug(techTags:', techTags);
                verboseDebug(geminiService.generateSummary 호출 시작');
                verboseDebug(generateSummary 메서드 타입:', typeof geminiService.generateSummary);
                verboseDebug(generateSummary 메서드 내용:', geminiService.generateSummary.toString().substring(0, 100) + '...');

                let summary;
                try {
                    summary = await geminiService.generateSummary(preprocessedContent, 160, techTags);
                    verboseDebug(generateSummary 호출 성공');
                } catch (error) {
                    logger.error(generateSummary 호출 실패:', error);
                    logger.error(에러 스택:', error.stack);
                    throw error;
                }

                verboseDebug(AI 요약 생성 완료 - summary 길이:', summary.length);
                verboseDebug(summary 내용:', summary.substring(0, 100) + '...');

                res.json({
                    success: true,
                    data: {
                        summary: summary,
                        originalLength: content.length,
                        summaryLength: summary.length
                    },
                    message: 'Gemini AI로 요약이 생성되었습니다.'
                });
            }

        } catch (error) {
            logger.error(Gemini AI 요약 생성 실패:', error);
            logger.error(에러 스택:', error.stack);
            res.status(500).json({
                success: false,
                message: 'AI 요약 생성에 실패했습니다.'
            });
        }
    }
);

router.post('/ai/keywords',
    authenticateToken,
    requirePermission('blog.create'),
    async (req, res) => {
        try {
            const { content, maxKeywords = 10, techTags = [] } = req.body;

            if (!content || content.trim().length < 1) {
                return res.status(400).json({
                    success: false,
                    message: '키워드를 추출할 내용이 없습니다.'
                });
            }

            const preprocessedContent = content.replace(/__([^_]+)__/g, (match, projectName) => {
                verboseDebug(` 키워드 추출 전처리: ${match} → ${projectName} 프로젝트`);
                return `${projectName} 프로젝트`;
            });

            const keywords = await geminiService.extractKeywords(preprocessedContent, maxKeywords, techTags);

            res.json({
                success: true,
                data: {
                    keywords: keywords,
                    keywordsString: keywords.join(', '),
                    originalLength: content.length,
                    keywordCount: keywords.length
                },
                message: 'Gemini AI로 키워드가 추출되었습니다.'
            });

        } catch (error) {
            logger.error('Gemini AI 키워드 추출 실패:', error);
            res.status(500).json({
                success: false,
                message: 'AI 키워드 추출에 실패했습니다.'
            });
        }
    }
);


router.get('/contacts', authenticateToken, requirePermission('contacts.read'), async (req, res) => {
    try {
        const { limit, page, unread } = req.query;
        const pageLimit = parseInt(limit) || 50;
        const offset = page ? (parseInt(page) - 1) * pageLimit : 0;

        let messages;
        if (unread === 'true') {
            messages = await ContactMessages.getUnread(pageLimit);
        } else {
            messages = await ContactMessages.getAll(pageLimit, offset);
        }

        res.json({
            success: true,
            data: messages,
            pagination: {
                page: parseInt(page) || 1,
                limit: pageLimit,
                total: messages.length
            }
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: '연락처 메시지를 가져오는데 실패했습니다.'
        });
    }
});

router.put('/contacts/:id/read',
    authenticateToken,
    requirePermission('contacts.update'),
    logActivity('mark_contact_read'),
    async (req, res) => {
        try {
            const message = await ContactMessages.markAsRead(req.params.id);

            res.json({
                success: true,
                message: '메시지가 읽음 처리되었습니다.',
                data: message
            });
        } catch (error) {
            res.status(500).json({
                success: false,
                message: '메시지 읽음 처리에 실패했습니다.'
            });
        }
    }
);

router.delete('/contacts/:id',
    authenticateToken,
    requirePermission('contacts.delete'),
    logActivity('delete_contact'),
    async (req, res) => {
        try {
            const messageId = req.params.id;

            if (!messageId) {
                return res.status(400).json({
                    success: false,
                    message: '메시지 ID가 필요합니다.'
                });
            }

            await ContactMessages.delete(messageId);

            res.json({
                success: true,
                message: '메시지가 성공적으로 삭제되었습니다.'
            });
        } catch (error) {
            logger.error('연락처 메시지 삭제 실패:', error);
            res.status(500).json({
                success: false,
                message: '메시지 삭제에 실패했습니다.'
            });
        }
    }
);


router.get('/settings', authenticateToken, requirePermission('settings.read'), async (req, res) => {
    try {
        const settings = await SiteSettings.getAllSettings();

        res.json({
            success: true,
            data: settings
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: '설정을 가져오는데 실패했습니다.'
        });
    }
});

router.put('/settings',
    authenticateToken,
    requirePermission('settings.update'),
    logActivity('update_settings'),
    async (req, res) => {
        try {
            const { settings } = req.body;

            for (const [key, config] of Object.entries(settings)) {
                await SiteSettings.set(
                    key,
                    config.value,
                    config.type,
                    config.is_public,
                    config.description
                );
            }

            res.json({
                success: true,
                message: '설정이 업데이트되었습니다.'
            });
        } catch (error) {
            res.status(500).json({
                success: false,
                message: '설정 업데이트에 실패했습니다.'
            });
        }
    }
);


router.get('/logs', authenticateToken, requireRole(['super_admin', 'admin']), async (req, res) => {
    try {
        const { limit, page, admin_id, action, resource } = req.query;
        const pageLimit = parseInt(limit) || 50;
        const offset = page ? (parseInt(page) - 1) * pageLimit : 0;

        let logs;
        if (admin_id) {
            logs = await AdminActivityLogs.getByAdmin(admin_id, pageLimit, offset);
        } else if (action) {
            logs = await AdminActivityLogs.getByAction(action, pageLimit);
        } else {
            logs = await AdminActivityLogs.getAll(pageLimit, offset);
        }

        res.json({
            success: true,
            data: logs,
            pagination: {
                page: parseInt(page) || 1,
                limit: pageLimit,
                total: logs.length
            }
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: '활동 로그를 가져오는데 실패했습니다.'
        });
    }
});

router.get('/logs/stats', authenticateToken, requireRole(['super_admin', 'admin']), async (req, res) => {
    try {
        const { days } = req.query;
        const period = parseInt(days) || 30;

        const [
            generalStats,
            activityStats,
            resourceStats,
            dailyStats
        ] = await Promise.all([
            AdminActivityLogs.getStats(period),
            AdminActivityLogs.getActivityStats(period),
            AdminActivityLogs.getResourceStats(period),
            AdminActivityLogs.getDailyStats(period)
        ]);

        res.json({
            success: true,
            data: {
                general: generalStats,
                activities: activityStats,
                resources: resourceStats,
                daily: dailyStats
            }
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: '활동 통계를 가져오는데 실패했습니다.'
        });
    }
});

router.get('/tags', authenticateToken, requirePermission('tags.read'), async (req, res) => {
    try {
        const { type, popular } = req.query;
        let tags;
        if (popular === 'true') {
            tags = await Tags.getPopular(50, { type });
        } else {
            tags = await Tags.getAll({ type });
        }
        res.json({ success: true, data: tags });
    } catch (error) {
        res.status(500).json({ success: false, message: '태그 목록을 가져오는데 실패했습니다.' });
    }
});

router.post('/tags', authenticateToken, requirePermission('tags.create'), logActivity('create_tag'), async (req, res) => {
    try {
        const { name, slug, description, color, type } = req.body;
        if (!name) {
            return res.status(400).json({ success: false, message: '태그 이름은 필수입니다.' });
        }
        const id = await Tags.create({ name, slug, description, color, type });
        const created = await Tags.getById(id);
        res.status(201).json({ success: true, message: '태그가 생성되었습니다.', data: created });
    } catch (error) {
        res.status(500).json({ success: false, message: '태그 생성에 실패했습니다.' });
    }
});

router.put('/tags/:id', authenticateToken, requirePermission('tags.update'), logActivity('update_tag'), async (req, res) => {
    try {
        const updated = await Tags.update(req.params.id, req.body);
        res.json({ success: true, message: '태그가 업데이트되었습니다.', data: updated });
    } catch (error) {
        res.status(500).json({ success: false, message: '태그 업데이트에 실패했습니다.' });
    }
});

router.delete('/tags/:id', authenticateToken, requirePermission('tags.delete'), logActivity('delete_tag'), async (req, res) => {
    try {
        await Tags.delete(req.params.id);
        res.json({ success: true, message: '태그가 삭제되었습니다.' });
    } catch (error) {
        res.status(500).json({ success: false, message: '태그 삭제에 실패했습니다.' });
    }
});

module.exports = router;

const multer = require('multer');
const path = require('path');
const fs = require('fs');

const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        const uploadPath = path.join(__dirname, '../uploads/images');

        if (!fs.existsSync(uploadPath)) {
            fs.mkdirSync(uploadPath, { recursive: true });
        }

        cb(null, uploadPath);
    },
    filename: function (req, file, cb) {
        const timestamp = Date.now();

        const ext = path.extname(file.originalname).toLowerCase();

        let baseName = path.basename(file.originalname, ext);

        baseName = baseName
            .replace(/[^a-zA-Z0-9가-힣]/g, '')  // 특수문자 모두 제거
            .substring(0, 20);  // 최대 20자로 제한

        if (!baseName) {
            baseName = 'image';
        }

        const finalName = `${timestamp}-${baseName}${ext}`;

        cb(null, finalName);
    }
});

/**
 * @description 관리자 라우트에서 허용할 파일 유형을 필터링한다.
  * @param {*} req 입력값
  * @param {*} file 입력값
  * @param {*} cb 입력값
 * @returns {any} 처리 결과
 */
const fileFilter = (req, file, cb) => {
    const allowedMimes = [
        'image/jpeg',
        'image/jpg',
        'image/png',
        'image/gif',
        'image/webp'
    ];

    if (allowedMimes.includes(file.mimetype)) {
        cb(null, true);
    } else {
        cb(new Error('지원되지 않는 이미지 형식입니다.'), false);
    }
};

const upload = multer({
    storage: storage,
    fileFilter: fileFilter,
    limits: {
        fileSize: 5 * 1024 * 1024 // 5MB 제한
    }
});

router.post('/upload/image',
    authenticateToken,
    upload.single('image'),
    logActivity('upload_image'),
    async (req, res) => {
        try {
            if (!req.file) {
                return res.status(400).json({
                    success: false,
                    message: '업로드할 이미지 파일이 없습니다.'
                });
            }

            const fileInfo = {
                originalName: req.file.originalname,
                filename: req.file.filename,
                size: req.file.size,
                mimetype: req.file.mimetype,
                path: req.file.path
            };

            const baseUrl = req.protocol + '://' + req.get('host');
            const imageUrl = `${baseUrl}/uploads/images/${req.file.filename}`;

            verboseDebug('이미지 업로드 성공:', fileInfo);

            res.json({
                success: true,
                message: '이미지가 성공적으로 업로드되었습니다.',
                data: {
                    url: imageUrl,
                    filename: req.file.filename,
                    originalName: req.file.originalname,
                    size: req.file.size
                }
            });

        } catch (error) {
            logger.error('이미지 업로드 실패:', error);
            res.status(500).json({
                success: false,
                message: error.message || '이미지 업로드에 실패했습니다.'
            });
        }
    }
);

router.delete('/upload/image/:filename',
    authenticateToken,
    requirePermission('files.delete'),
    logActivity('delete_image'),
    async (req, res) => {
        try {
            const filename = req.params.filename;
            const filePath = path.join(__dirname, '../uploads/images', filename);

            if (!fs.existsSync(filePath)) {
                return res.status(404).json({
                    success: false,
                    message: '삭제할 이미지를 찾을 수 없습니다.'
                });
            }

            fs.unlinkSync(filePath);

            res.json({
                success: true,
                message: '이미지가 성공적으로 삭제되었습니다.'
            });

        } catch (error) {
            logger.error('이미지 삭제 실패:', error);
            res.status(500).json({
                success: false,
                message: '이미지 삭제에 실패했습니다.'
            });
        }
    }
);


router.get('/logs',
    authenticateToken,
    requirePermission('logs.read'),
    async (req, res) => {
        try {
            const {
                search = '',
                user = 'all',
                action = 'all',
                resource_type = 'all',
                date_filter = 'all',
                page = 1,
                limit = 50
            } = req.query;

            const filters = {
                search,
                user,
                action,
                resource_type,
                date_filter,
                page: parseInt(page),
                limit: parseInt(limit)
            };

            const ActivityLogs = require('../models/activity-logs');
            const logs = await ActivityLogs.findWithFilters(filters);
            const total = await ActivityLogs.countWithFilters(filters);

            res.json({
                success: true,
                data: logs,
                pagination: {
                    page: parseInt(page),
                    limit: parseInt(limit),
                    total,
                    pages: Math.ceil(total / parseInt(limit))
                }
            });

        } catch (error) {
            logger.error('활동 로그 조회 실패:', error);
            res.status(500).json({
                success: false,
                message: '활동 로그를 가져오는데 실패했습니다.'
            });
        }
    }
);

router.get('/logs/stats',
    authenticateToken,
    requirePermission('logs.read'),
    async (req, res) => {
        try {
            const ActivityLogs = require('../models/activity-logs');
            const stats = await ActivityLogs.getStats();

            res.json({
                success: true,
                data: stats
            });

        } catch (error) {
            logger.error('활동 로그 통계 조회 실패:', error);
            res.status(500).json({
                success: false,
                message: '활동 로그 통계를 가져오는데 실패했습니다.'
            });
        }
    }
);

router.get('/logs/export',
    authenticateToken,
    requirePermission('logs.read'),
    async (req, res) => {
        try {
            const {
                search = '',
                user = 'all',
                action = 'all',
                resource_type = 'all',
                date_filter = 'all'
            } = req.query;

            const filters = {
                search,
                user,
                action,
                resource_type,
                date_filter,
                page: 1,
                limit: 10000 // 최대 10,000개 로그 내보내기
            };

            const ActivityLogs = require('../models/activity-logs');
            const logs = await ActivityLogs.findWithFilters(filters);

            const csvHeaders = [
                'ID', '사용자 ID', '사용자명', '액션', '리소스 타입',
                '리소스 ID', '리소스명', '상세정보', 'IP 주소', 'OS + 브라우저', '생성일'
            ];

            const csvData = logs.map(log => [
                log.id,
                log.user_id,
                log.username,
                log.action,
                log.resource_type,
                log.resource_id || '',
                log.resource_name || '',
                log.details || '',
                log.ip_address || '',
                log.user_agent || '',
                new Date(log.created_at).toLocaleString('ko-KR')
            ]);

            const csvContent = [
                csvHeaders.join(','),
                ...csvData.map(row => row.map(field => `"${field}"`).join(','))
            ].join('\n');

            const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
            const filename = `activity-logs-${timestamp}.csv`;

            res.setHeader('Content-Type', 'text/csv; charset=utf-8');
            res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
            res.send(csvContent);

        } catch (error) {
            logger.error('활동 로그 내보내기 실패:', error);
            res.status(500).json({
                success: false,
                message: '활동 로그 내보내기에 실패했습니다.'
            });
        }
    }
);


router.post('/skills/categories',
    authenticateToken,
    requirePermission('skills.create'),
    logActivity('create_skill_category'),
    async (req, res) => {
        try {
            const { name } = req.body;

            if (!name || !name.trim()) {
                return res.status(400).json({
                    success: false,
                    message: '카테고리명을 입력해주세요.'
                });
            }

            const Skills = require('../models/skills');
            const existingCategory = await Skills.getCategoryByName(name.trim());
            
            if (existingCategory) {
                return res.status(400).json({
                    success: false,
                    message: '이미 존재하는 카테고리명입니다.'
                });
            }

            const categoryId = await Skills.createCategory(name.trim());

            res.status(201).json({
                success: true,
                message: '카테고리가 성공적으로 추가되었습니다.',
                data: { id: categoryId, name: name.trim() }
            });

        } catch (error) {
            logger.error('카테고리 추가 실패:', error);
            res.status(500).json({
                success: false,
                message: '카테고리 추가에 실패했습니다.'
            });
        }
    }
);

router.delete('/skills/categories/:id',
    authenticateToken,
    requirePermission('skills.delete'),
    logActivity('delete_skill_category'),
    async (req, res) => {
        try {
            const categoryId = req.params.id;

            if (!categoryId) {
                return res.status(400).json({
                    success: false,
                    message: '카테고리 ID가 필요합니다.'
                });
            }

            const Skills = require('../models/skills');
            
            const skillsUsingCategory = await Skills.getSkillsByCategory(categoryId);
            
            if (skillsUsingCategory && skillsUsingCategory.length > 0) {
                return res.status(400).json({
                    success: false,
                    message: '이 카테고리를 사용하는 기술 스택이 있어서 삭제할 수 없습니다.',
                    data: {
                        category_id: categoryId,
                        skills_count: skillsUsingCategory.length,
                        skills: skillsUsingCategory.map(skill => ({ id: skill.id, name: skill.name }))
                    }
                });
            }

            await Skills.deleteCategory(categoryId);

            res.json({
                success: true,
                message: '카테고리가 성공적으로 삭제되었습니다.'
            });

        } catch (error) {
            logger.error('카테고리 삭제 실패:', error);
            res.status(500).json({
                success: false,
                message: '카테고리 삭제에 실패했습니다.'
            });
        }
    }
);

router.get('/skills/categories',
    authenticateToken,
    requirePermission('skills.read'),
    async (req, res) => {
        try {
            const Skills = require('../models/skills');
            const categories = await Skills.getCategories();

            res.json({
                success: true,
                data: categories
            });

        } catch (error) {
            logger.error('카테고리 목록 조회 실패:', error);
            res.status(500).json({
                success: false,
                message: '카테고리 목록을 가져오는데 실패했습니다.'
            });
        }
    }
);


router.get('/skills',
    authenticateToken,
    requirePermission('skills.read'),
    async (req, res) => {
        try {
            const Skills = require('../models/skills');
            const skills = await Skills.getAll();

            res.json({
                success: true,
                data: skills
            });

        } catch (error) {
            logger.error('기술 스택 목록 조회 실패:', error);
            res.status(500).json({
                success: false,
                message: '기술 스택 목록을 가져오는데 실패했습니다.'
            });
        }
    }
);

router.post('/skills',
    authenticateToken,
    requirePermission('skills.create'),
    logActivity('create_skill'),
    async (req, res) => {
        try {
            const { name, category_id, proficiency_level, display_order, is_featured } = req.body;

            if (!name || !category_id) {
                return res.status(400).json({
                    success: false,
                    message: '기술명과 카테고리는 필수입니다.'
                });
            }

            const Skills = require('../models/skills');
            
            if (is_featured && display_order) {
                const existingSkill = await Skills.getByDisplayOrder(display_order);
                if (existingSkill) {
                    return res.status(400).json({
                        success: false,
                        message: `표시 순서 ${display_order}은(는) 이미 사용 중입니다. 다른 순서를 선택해주세요.`
                    });
                }
            }
            
            const cleanData = {
                name: name || '',
                category_id: category_id || '',
                proficiency_level: proficiency_level || 50,
                display_order: display_order || 0,
                is_featured: is_featured || false
            };
            
            const skillId = await Skills.createSkill(cleanData);

            const newSkill = await Skills.getSkillById(skillId);

            res.status(201).json({
                success: true,
                message: '기술 스택이 성공적으로 추가되었습니다.',
                data: newSkill
            });

        } catch (error) {
            logger.error('기술 스택 생성 실패:', error);
            res.status(500).json({
                success: false,
                message: '기술 스택 생성에 실패했습니다.'
            });
        }
    }
);

router.put('/skills/:id',
    authenticateToken,
    requirePermission('skills.update'),
    logActivity('update_skill'),
    async (req, res) => {
        try {
            const skillId = req.params.id;
            const { name, category_id, proficiency_level, display_order, is_featured } = req.body;
            

            if (!name || !category_id) {
                return res.status(400).json({
                    success: false,
                    message: '기술명과 카테고리는 필수입니다.'
                });
            }

            const Skills = require('../models/skills');
            
            if (is_featured && display_order) {
                const existingSkill = await Skills.getByDisplayOrder(display_order, skillId);
                if (existingSkill) {
                    return res.status(400).json({
                        success: false,
                        message: `표시 순서 ${display_order}은(는) 이미 사용 중입니다. 다른 순서를 선택해주세요.`
                    });
                }
            }
            
            const cleanData = {
                name: name || '',
                category_id: category_id || '',
                proficiency_level: proficiency_level || 50,
                display_order: display_order || 0,
                is_featured: is_featured || false
            };
            
            await Skills.updateSkill(skillId, cleanData);

            const updatedSkill = await Skills.getSkillById(skillId);

            res.json({
                success: true,
                message: '기술 스택이 성공적으로 수정되었습니다.',
                data: updatedSkill
            });

        } catch (error) {
            logger.error('기술 스택 수정 실패:', error);
            res.status(500).json({
                success: false,
                message: '기술 스택 수정에 실패했습니다.'
            });
        }
    }
);

router.delete('/skills/:id',
    authenticateToken,
    requirePermission('skills.delete'),
    logActivity('delete_skill'),
    async (req, res) => {
        try {
            const skillId = req.params.id;

            if (!skillId) {
                return res.status(400).json({
                    success: false,
                    message: '기술 스택 ID가 필요합니다.'
                });
            }

            const Skills = require('../models/skills');
            await Skills.deleteSkill(skillId);

            res.json({
                success: true,
                message: '기술 스택이 성공적으로 삭제되었습니다.'
            });

        } catch (error) {
            logger.error('기술 스택 삭제 실패:', error);
            res.status(500).json({
                success: false,
                message: '기술 스택 삭제에 실패했습니다.'
            });
        }
    }
);

router.patch('/skills/:id/featured',
    authenticateToken,
    requirePermission('skills.update'),
    logActivity('toggle_skill_featured'),
    async (req, res) => {
        try {
            const skillId = req.params.id;
            const { is_featured } = req.body;

            if (typeof is_featured !== 'boolean') {
                return res.status(400).json({
                    success: false,
                    message: '추천 상태는 boolean 값이어야 합니다.'
                });
            }

            const Skills = require('../models/skills');
            await Skills.updateSkill(skillId, { is_featured });

            res.json({
                success: true,
                message: `기술 스택이 ${is_featured ? '추천' : '일반'} 상태로 변경되었습니다.`
            });

        } catch (error) {
            logger.error('기술 스택 추천 상태 변경 실패:', error);
            res.status(500).json({
                success: false,
                message: '기술 스택 추천 상태 변경에 실패했습니다.'
            });
        }
    }
);

router.patch('/skills/:id/order',
    authenticateToken,
    requirePermission('skills.update'),
    logActivity('update_skill_order'),
    async (req, res) => {
        try {
            const skillId = req.params.id;
            const { display_order } = req.body;

            if (typeof display_order !== 'number' || display_order < 0) {
                return res.status(400).json({
                    success: false,
                    message: '표시 순서는 0 이상의 숫자여야 합니다.'
                });
            }

            const Skills = require('../models/skills');
            await Skills.updateSkill(skillId, { display_order });

            res.json({
                success: true,
                message: '기술 스택 순서가 성공적으로 변경되었습니다.'
            });

        } catch (error) {
            logger.error('기술 스택 순서 변경 실패:', error);
            res.status(500).json({
                success: false,
                message: '기술 스택 순서 변경에 실패했습니다.'
            });
        }
    }
);