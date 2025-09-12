/**
 * @swagger
 * components:
 *   schemas:
 *     BlogPost:
 *       type: object
 *       properties:
 *         id:
 *           type: integer
 *           example: 1
 *         title:
 *           type: string
 *           example: "Next.js 15 새로운 기능들"
 *         slug:
 *           type: string
 *           example: "nextjs-15-new-features"
 *         content:
 *           type: string
 *           example: "마크다운 콘텐츠..."
 *         excerpt:
 *           type: string
 *           example: "Next.js 15의 새로운 기능들을 소개합니다."
 *         featured_image:
 *           type: string
 *           example: "https://example.com/image.jpg"
 *         is_published:
 *           type: boolean
 *           example: true
 *         is_featured:
 *           type: boolean
 *           example: false
 *         view_count:
 *           type: integer
 *           example: 150
 *         created_at:
 *           type: string
 *           format: date-time
 *           example: "2024-01-15T10:30:00Z"
 *         updated_at:
 *           type: string
 *           format: date-time
 *           example: "2024-01-15T10:30:00Z"
 *         tags:
 *           type: array
 *           items:
 *             type: object
 *             properties:
 *               id:
 *                 type: integer
 *                 example: 1
 *               name:
 *                 type: string
 *                 example: "Next.js"
 *     Project:
 *       type: object
 *       properties:
 *         id:
 *           type: integer
 *           example: 1
 *         title:
 *           type: string
 *           example: "포트폴리오 웹사이트"
 *         slug:
 *           type: string
 *           example: "portfolio-website"
 *         description:
 *           type: string
 *           example: "개인 포트폴리오 웹사이트입니다."
 *         content:
 *           type: string
 *           example: "프로젝트 상세 설명..."
 *         demo_url:
 *           type: string
 *           example: "https://example.com"
 *         github_url:
 *           type: string
 *           example: "https://github.com/user/project"
 *         image_url:
 *           type: string
 *           example: "https://example.com/project.jpg"
 *         is_featured:
 *           type: boolean
 *           example: true
 *         status:
 *           type: string
 *           enum: [completed, in_progress, planning]
 *           example: "completed"
 *         start_date:
 *           type: string
 *           format: date
 *           example: "2024-01-01"
 *         end_date:
 *           type: string
 *           format: date
 *           example: "2024-02-01"
 *         view_count:
 *           type: integer
 *           example: 250
 *         created_at:
 *           type: string
 *           format: date-time
 *           example: "2024-01-15T10:30:00Z"
 *         tags:
 *           type: array
 *           items:
 *             type: object
 *             properties:
 *               id:
 *                 type: integer
 *                 example: 1
 *               name:
 *                 type: string
 *                 example: "React"
 *     ContactMessage:
 *       type: object
 *       properties:
 *         id:
 *           type: integer
 *           example: 1
 *         name:
 *           type: string
 *           example: "홍길동"
 *         email:
 *           type: string
 *           format: email
 *           example: "user@example.com"
 *         subject:
 *           type: string
 *           example: "문의사항"
 *         message:
 *           type: string
 *           example: "안녕하세요. 문의드릴 내용이 있습니다."
 *         status:
 *           type: string
 *           enum: [unread, read, replied]
 *           example: "unread"
 *         created_at:
 *           type: string
 *           format: date-time
 *           example: "2024-01-15T10:30:00Z"
 */

const express = require('express');
const router = express.Router();
const logger = require('../log');

// 개별 모델들 import
const PersonalInfo = require('../models/personal-info');
const SocialLinks = require('../models/social-links');
const Skills = require('../models/skills');
const Projects = require('../models/projects');
const BlogPosts = require('../models/blog-posts');
const BlogTags = require('../models/blog-tags');
const Tags = require('../models/tags');
const ContactMessages = require('../models/contact-messages');
const Experiences = require('../models/experiences');
const Interests = require('../models/interests');
const SiteSettings = require('../models/site-settings');
const { executeQuery } = require('../models/db-utils');

// 인증 미들웨어 import (일부 라우트에서 사용)
const { authenticateToken, requirePermission, logActivity } = require('../middleware/auth');

// 공개 설정 조회 (프론트엔드용)
router.get('/settings', async (req, res) => {
    try {
        const settings = await SiteSettings.getPublicSettings();
        
        res.json({
            success: true,
            data: settings
        });
    } catch (error) {
        logger.database('SELECT 실패', 'site_settings', {
            error: error.message,
            operation: 'getPublicSettings'
        });
        res.status(500).json({
            success: false,
            message: '설정을 가져오는데 실패했습니다.'
        });
    }
});

/**
 * @openapi
 * paths:
 *   /personal-info:
 *     get:
 *       summary: 개인 정보 조회
 *       tags: [Profile]
 *       responses:
 *         200:
 *           description: 성공
 *     put:
 *       summary: 개인 정보 수정
 *       tags: [Profile]
 *       responses:
 *         200:
 *           description: 성공
 *   /social-links:
 *     get:
 *       summary: 소셜 링크 목록
 *       tags: [Social]
 *       responses:
 *         200:
 *           description: 성공
 *     post:
 *       summary: 소셜 링크 생성
 *       tags: [Social]
 *       responses:
 *         201:
 *           description: 생성됨
 *   /skills:
 *     get:
 *       summary: 스킬 및 카테고리 조회
 *       tags: [Skills]
 *       responses:
 *         200:
 *           description: 성공
 *     post:
 *       summary: 스킬 추가 (관리자)
 *       security: [{ bearerAuth: [] }]
 *       tags: [Skills]
 *       responses:
 *         201:
 *           description: 생성됨
 *   /skills/featured:
 *     get:
 *       summary: 주요 스킬 조회
 *       tags: [Skills]
 *       responses:
 *         200:
 *           description: 성공
 *   /projects:
 *     get:
 *       summary: 프로젝트 목록
 *       tags: [Projects]
 *       responses:
 *         200:
 *           description: 성공
 *     post:
 *       summary: 프로젝트 생성 (관리자)
 *       security: [{ bearerAuth: [] }]
 *       tags: [Projects]
 *       responses:
 *         201:
 *           description: 생성됨
 *   /projects/{id}:
 *     get:
 *       summary: 프로젝트 상세
 *       tags: [Projects]
 *       parameters:
 *         - in: path
 *           name: id
 *           required: true
 *           schema: { type: integer }
 *       responses:
 *         200:
 *           description: 성공
 *   /projects/tag/{tagSlug}:
 *     get:
 *       summary: 태그별 프로젝트 목록
 *       tags: [Projects, Tags]
 *       parameters:
 *         - in: path
 *           name: tagSlug
 *           required: true
 *           schema: { type: string }
 *       responses:
 *         200:
 *           description: 성공
 *   /blog/posts:
 *     get:
 *       summary: 블로그 포스트 목록
 *       tags: [Blog]
 *       responses:
 *         200:
 *           description: 성공
 *     post:
 *       summary: 블로그 포스트 생성 (관리자)
 *       security: [{ bearerAuth: [] }]
 *       tags: [Blog]
 *       responses:
 *         201:
 *           description: 생성됨
 *   /blog/posts/{slug}:
 *     get:
 *       summary: 블로그 포스트 상세 (슬러그)
 *       tags: [Blog]
 *       parameters:
 *         - in: path
 *           name: slug
 *           required: true
 *           schema: { type: string }
 *       responses:
 *         200:
 *           description: 성공
 *   /blog/search:
 *     get:
 *       summary: 블로그 검색
 *       tags: [Blog]
 *       parameters:
 *         - in: query
 *           name: q
 *           schema: { type: string }
 *       responses:
 *         200:
 *           description: 성공
 *   /tags:
 *     get:
 *       summary: 통합 태그 목록
 *       tags: [Tags]
 *       parameters:
 *         - in: query
 *           name: type
 *           schema: { type: string, enum: [blog, project, general] }
 *       responses:
 *         200:
 *           description: 성공
 *   /tags/{slug}:
 *     get:
 *       summary: 태그 단건 조회
 *       tags: [Tags]
 *       parameters:
 *         - in: path
 *           name: slug
 *           required: true
 *           schema: { type: string }
 *       responses:
 *         200:
 *           description: 성공
 *   /experiences:
 *     get:
 *       summary: 경력/경험 목록
 *       tags: [Experiences]
 *       responses:
 *         200:
 *           description: 성공
 *     post:
 *       summary: 경력 추가 (관리자)
 *       security: [{ bearerAuth: [] }]
 *       tags: [Experiences]
 *       responses:
 *         201:
 *           description: 생성됨
 *   /experiences/timeline:
 *     get:
 *       summary: 경력 타임라인
 *       tags: [Experiences]
 *       responses:
 *         200:
 *           description: 성공
 *   /settings:
 *     get:
 *       summary: 공개 사이트 설정 조회
 *       tags: [Settings]
 *       responses:
 *         200:
 *           description: 성공
 *   /contact:
 *     post:
 *       summary: 연락처 메시지 전송
 *       tags: [Contact]
 *       responses:
 *         201:
 *           description: 생성됨
 *   /dashboard/stats:
 *     get:
 *       summary: 대시보드 통계 (공개 요약)
 *       tags: [Dashboard]
 *       responses:
 *         200:
 *           description: 성공
 *   /search:
 *     get:
 *       summary: 통합 검색
 *       tags: [Search]
 *       parameters:
 *         - in: query
 *           name: q
 *           schema: { type: string }
 *       responses:
 *         200:
 *           description: 성공
 *   /health:
 *     get:
 *       summary: 헬스 체크
 *       tags: [Health]
 *       responses:
 *         200:
 *           description: 성공
 */
/**
 * @openapi
 * /blog/posts:
 *   get:
 *     summary: 블로그 포스트 목록 조회
 *     tags: [Blog]
 *     parameters:
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: 성공
 */
// 🏠 개인 정보 라우트
router.get('/personal-info', async (req, res) => {
    try {
        const info = await PersonalInfo.get();
        res.json({
            success: true,
            data: info
        });
    } catch (error) {
        logger.error('Personal info fetch error:', error);
        res.status(500).json({
            success: false,
            message: '개인 정보를 가져오는데 실패했습니다.'
        });
    }
});

router.put('/personal-info', async (req, res) => {
    try {
        // undefined 값을 null로 변환
        const cleanedData = Object.fromEntries(
            Object.entries(req.body).map(([key, value]) => [
                key, 
                (value === undefined || value === '') ? null : value
            ])
        );
        
        const updatedInfo = await PersonalInfo.update(cleanedData);
        res.json({
            success: true,
            message: '개인 정보가 업데이트되었습니다.',
            data: updatedInfo
        });
    } catch (error) {
        logger.error('Personal info update error:', error);
        res.status(500).json({
            success: false,
            message: '개인 정보 업데이트에 실패했습니다.'
        });
    }
});

// 🔗 소셜 링크 라우트
router.get('/social-links', async (req, res) => {
    try {
        const links = await SocialLinks.getAll();
        res.json({
            success: true,
            data: links
        });
    } catch (error) {
        logger.error('Social links fetch error:', error);
        res.status(500).json({
            success: false,
            message: '소셜 링크를 가져오는데 실패했습니다.'
        });
    }
});

router.post('/social-links', async (req, res) => {
    try {
        const { platform, url, icon, display_order } = req.body;
        
        if (!platform || !url) {
            return res.status(400).json({
                success: false,
                message: '플랫폼과 URL은 필수입니다.'
            });
        }

        const id = await SocialLinks.create({ platform, url, icon, display_order });
        const newLink = await SocialLinks.getById(id);
        
        res.status(201).json({
            success: true,
            message: '소셜 링크가 추가되었습니다.',
            data: newLink
        });
    } catch (error) {
        logger.error('Social link creation error:', error);
        res.status(500).json({
            success: false,
            message: '소셜 링크 추가에 실패했습니다.'
        });
    }
});

// 💪 스킬 라우트
router.get('/skills', async (req, res) => {
    try {
        const skills = await Skills.getAllWithCategories();
        const categories = await Skills.getCategories();
        
        // 카테고리별로 스킬 그룹화
        const skillsByCategory = categories.map(category => ({
            ...category,
            skills: skills.filter(skill => skill.category_id === category.id)
        }));

        res.json({
            success: true,
            data: {
                skills,
                categories,
                skillsByCategory
            }
        });
    } catch (error) {
        logger.error('Skills fetch error:', error);
        res.status(500).json({
            success: false,
            message: '스킬 정보를 가져오는데 실패했습니다.'
        });
    }
});

router.get('/skills/featured', async (req, res) => {
    try {
        const featuredSkills = await Skills.getFeatured();
        res.json({
            success: true,
            data: featuredSkills
        });
    } catch (error) {
        logger.error('Featured skills fetch error:', error);
        res.status(500).json({
            success: false,
            message: '주요 스킬 정보를 가져오는데 실패했습니다.'
        });
    }
});

// 스킬 추가 (관리자 전용)
router.post('/skills', 
    authenticateToken, 
    requirePermission('skills.create'), 
    logActivity('create_skill'),
    async (req, res) => {
        try {
            const { category_id, name, proficiency_level, years_of_experience, icon, color, display_order, is_featured } = req.body;
            
            if (!name) {
                return res.status(400).json({
                    success: false,
                    message: '스킬 이름은 필수입니다.'
                });
            }

            const id = await Skills.createSkill({
                category_id,
                name,
                proficiency_level: proficiency_level || 1,
                years_of_experience,
                icon,
                color,
                display_order: display_order || 0,
                is_featured: is_featured || false
            });

            res.status(201).json({
                success: true,
                message: '스킬이 추가되었습니다.',
                data: { id }
            });
        } catch (error) {
            logger.error('Skill creation error:', error);
            res.status(500).json({
                success: false,
                message: '스킬 추가에 실패했습니다.'
            });
        }
    }
);

/**
 * @swagger
 * /api/projects:
 *   get:
 *     summary: 프로젝트 목록 조회
 *     description: 공개된 프로젝트 목록을 조회합니다. 페이지네이션, 검색, 필터링을 지원합니다.
 *     tags: [Projects]
 *     parameters:
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 10
 *         description: 페이지당 프로젝트 수
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *         description: 페이지 번호
 *       - in: query
 *         name: featured
 *         schema:
 *           type: boolean
 *         description: 추천 프로젝트만 조회
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *         description: 검색 키워드
 *       - in: query
 *         name: tags
 *         schema:
 *           type: string
 *         description: 태그 필터 (쉼표로 구분)
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [completed, in_progress, planning]
 *         description: 프로젝트 상태 필터
 *       - in: query
 *         name: sort
 *         schema:
 *           type: string
 *           enum: [created_at, title, start_date, end_date]
 *           default: created_at
 *         description: 정렬 기준
 *       - in: query
 *         name: order
 *         schema:
 *           type: string
 *           enum: [asc, desc]
 *           default: desc
 *         description: 정렬 순서
 *     responses:
 *       200:
 *         description: 프로젝트 목록 조회 성공
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Project'
 *                 pagination:
 *                   type: object
 *                   properties:
 *                     total:
 *                       type: integer
 *                       example: 15
 *                     page:
 *                       type: integer
 *                       example: 1
 *                     limit:
 *                       type: integer
 *                       example: 10
 *                     totalPages:
 *                       type: integer
 *                       example: 2
 *       500:
 *         description: 서버 오류
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.get('/projects', async (req, res) => {
    try {
        const { 
            limit, 
            page, 
            featured, 
            search, 
            tags, 
            skills, 
            status, 
            sort, 
            order 
        } = req.query;
        
        const pageLimit = parseInt(limit) || 10;
        const offset = page ? (parseInt(page) - 1) * pageLimit : 0;

        // 필터 조건 구성
        const filters = {
            limit: pageLimit,
            offset: offset,
            search: search || '',
            tags: tags ? tags.split(',') : [],
            skills: skills ? skills.split(',') : [],
            featured: featured === 'true' ? true : (featured === 'false' ? false : null),
            status: status || 'published',
            sort: sort || 'created_at',
            order: order || 'desc',
            published_only: true
        };

        let projects, totalCount;
        
        if (featured === 'true') {
            // 메인 페이지용 - featured만 가져오기 (offset 무시)
            filters.offset = 0;
            projects = await Projects.getWithFilters(filters);
            totalCount = await Projects.getCountWithFilters({ ...filters, limit: 1000, offset: 0 });
        } else {
            // 목록 페이지용 - 필터 적용하여 가져오기
            projects = await Projects.getWithFilters(filters);
            totalCount = await Projects.getCountWithFilters(filters);
        }

        const totalPages = Math.ceil(totalCount / pageLimit);

        res.json({
            success: true,
            data: projects,
            pagination: {
                page: parseInt(page) || 1,
                limit: pageLimit,
                total: totalCount,
                totalPages: totalPages
            }
        });
    } catch (error) {
        logger.error('Projects fetch error:', error);
        res.status(500).json({
            success: false,
            message: '프로젝트 정보를 가져오는데 실패했습니다.'
        });
    }
});

// 프로젝트 상세 조회 (슬러그 기반)
router.get('/projects/slug/:slug', async (req, res) => {
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

// 태그로 프로젝트 조회
router.get('/projects/tag/:tagSlug', async (req, res) => {
    try {
        const { limit, page } = req.query;
        const pageLimit = parseInt(limit) || 10;
        const offset = page ? (parseInt(page) - 1) * pageLimit : 0;

        const projects = await executeQuery(`
            SELECT p.*, 
                   GROUP_CONCAT(DISTINCT s.name ORDER BY s.name ASC) as skills,
                   GROUP_CONCAT(DISTINCT t2.name ORDER BY t2.name ASC) as tags
            FROM projects p
            INNER JOIN tag_usage tu ON tu.content_type = 'project' AND tu.content_id = p.id
            INNER JOIN tags t ON t.id = tu.tag_id
            LEFT JOIN project_skills ps ON p.id = ps.project_id
            LEFT JOIN skills s ON ps.skill_id = s.id
            LEFT JOIN tag_usage tu2 ON tu2.content_type = 'project' AND tu2.content_id = p.id
            LEFT JOIN tags t2 ON t2.id = tu2.tag_id
            WHERE t.slug = ?
            GROUP BY p.id
            ORDER BY p.is_featured DESC, p.display_order ASC, p.created_at DESC
            LIMIT ? OFFSET ?
        `, [req.params.tagSlug, pageLimit, offset]);

        const result = projects.map(p => ({
            ...p,
            skills: p.skills ? p.skills.split(',') : [],
            tags: p.tags ? p.tags.split(',') : []
        }));

        res.json({
            success: true,
            data: result,
            pagination: {
                page: parseInt(page) || 1,
                limit: pageLimit,
                total: result.length
            }
        });
    } catch (error) {
        logger.error('Projects by tag fetch error:', error);
        res.status(500).json({ success: false, message: '태그별 프로젝트를 가져오는데 실패했습니다.' });
    }
});

// 프로젝트 생성은 admin.js로 이동됨

/**
 * @swagger
 * /api/blog/posts:
 *   get:
 *     summary: 블로그 포스트 목록 조회
 *     description: 공개된 블로그 포스트 목록을 조회합니다. 페이지네이션, 검색, 필터링을 지원합니다.
 *     tags: [Blog]
 *     parameters:
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 10
 *         description: 페이지당 포스트 수
 *       - in: query
 *         name: offset
 *         schema:
 *           type: integer
 *           default: 0
 *         description: 건너뛸 포스트 수
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *         description: 검색 키워드
 *       - in: query
 *         name: tag
 *         schema:
 *           type: string
 *         description: 태그 필터
 *       - in: query
 *         name: featured
 *         schema:
 *           type: boolean
 *         description: 추천 포스트만 조회
 *     responses:
 *       200:
 *         description: 블로그 포스트 목록 조회 성공
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/BlogPost'
 *                 pagination:
 *                   type: object
 *                   properties:
 *                     total:
 *                       type: integer
 *                       example: 25
 *                     limit:
 *                       type: integer
 *                       example: 10
 *                     offset:
 *                       type: integer
 *                       example: 0
 *                     hasMore:
 *                       type: boolean
 *                       example: true
 *       500:
 *         description: 서버 오류
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.get('/blog/posts', async (req, res) => {
    try {
        const { 
            limit, 
            page, 
            featured, 
            search, 
            tags, 
            status, 
            sort, 
            order 
        } = req.query;
        
        const pageLimit = parseInt(limit) || 10;
        const offset = page ? (parseInt(page) - 1) * pageLimit : 0;

        // 필터 조건 구성
        const filters = {
            limit: pageLimit,
            offset: offset,
            search: search || '',
            tags: tags ? tags.split(',') : [],
            featured: featured === 'true' ? true : (featured === 'false' ? false : null),
            status: status || 'published',
            sort: sort || 'published_at',
            order: order || 'desc',
            published_only: true
        };

        let posts, totalCount;
        
        if (featured === 'true') {
            // 메인 페이지용 - featured만 가져오기 (offset 무시)
            filters.offset = 0;
            posts = await BlogPosts.getWithFilters(filters);
            totalCount = await BlogPosts.getCountWithFilters({ ...filters, limit: 1000, offset: 0 });
        } else {
            // 목록 페이지용 - 필터 적용하여 가져오기
            posts = await BlogPosts.getWithFilters(filters);
            totalCount = await BlogPosts.getCountWithFilters(filters);
        }

        const totalPages = Math.ceil(totalCount / pageLimit);

        res.json({
            success: true,
            data: posts,
            pagination: {
                page: parseInt(page) || 1,
                limit: pageLimit,
                total: totalCount,
                totalPages: totalPages
            }
        });
    } catch (error) {
        logger.error('Blog posts fetch error:', error);
        res.status(500).json({
            success: false,
            message: '블로그 포스트를 가져오는데 실패했습니다.'
        });
    }
});




router.get('/blog/posts/:slug', async (req, res) => {
    try {
        const post = await BlogPosts.getBySlug(req.params.slug);
        
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
            message: '블로그 포스트를 가져오는데 실패했습니다.'
        });
    }
});

router.get('/blog/search', async (req, res) => {
    try {
        const { q, limit } = req.query;
        
        if (!q) {
            return res.status(400).json({
                success: false,
                message: '검색어를 입력해주세요.'
            });
        }

        const posts = await BlogPosts.search(q, parseInt(limit) || 10);

        res.json({
            success: true,
            data: posts,
            query: q
        });
    } catch (error) {
        logger.error('Blog search error:', error);
        res.status(500).json({
            success: false,
            message: '블로그 검색에 실패했습니다.'
        });
    }
});

// 📊 블로그 포스트 조회수 증가 (슬러그 기반)
router.post('/blog/posts/:slug/view', async (req, res) => {
    try {
        const postSlug = req.params.slug;
        
        // 블로그 포스트 존재 여부 확인 (슬러그로)
        const post = await executeQuery('SELECT id FROM blog_posts WHERE slug = ? AND is_published = TRUE', [postSlug]);
        
        if (!post || post.length === 0) {
            return res.status(404).json({
                success: false,
                message: '블로그 포스트를 찾을 수 없습니다.'
            });
        }

        // 조회수 증가
        await executeQuery('UPDATE blog_posts SET view_count = view_count + 1 WHERE id = ?', [post[0].id]);

        res.json({
            success: true,
            message: '조회수가 증가되었습니다.'
        });
    } catch (error) {
        logger.error('블로그 조회수 증가 실패:', error);
        res.status(500).json({
            success: false,
            message: '조회수 증가에 실패했습니다.'
        });
    }
});

// 블로그 포스트 생성 (관리자 전용)
router.post('/blog/posts', 
    authenticateToken, 
    requirePermission('blog.create'), 
    logActivity('create_blog_post'),
    async (req, res) => {
        try {
            const { title, content } = req.body;
            
            if (!title || !content) {
                return res.status(400).json({
                    success: false,
                    message: '제목과 내용은 필수입니다.'
                });
            }

            const id = await BlogPosts.create(req.body);
            const newPost = await BlogPosts.getById(id);

            res.status(201).json({
                success: true,
                message: '블로그 포스트가 생성되었습니다.',
                data: newPost
            });
        } catch (error) {
            logger.error('Blog post creation error:', error);
            res.status(500).json({
                success: false,
                message: '블로그 포스트 생성에 실패했습니다.'
            });
        }
    }
);


/**
 * @swagger
 * /api/contact:
 *   post:
 *     summary: 연락처 메시지 전송
 *     description: 방문자가 연락처 메시지를 전송합니다.
 *     tags: [Contact]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - name
 *               - email
 *               - subject
 *               - message
 *             properties:
 *               name:
 *                 type: string
 *                 example: "홍길동"
 *                 description: "이름"
 *               email:
 *                 type: string
 *                 format: email
 *                 example: "user@example.com"
 *                 description: "이메일 주소"
 *               subject:
 *                 type: string
 *                 example: "문의사항"
 *                 description: "제목"
 *               message:
 *                 type: string
 *                 example: "안녕하세요. 문의드릴 내용이 있습니다."
 *                 description: "메시지 내용"
 *     responses:
 *       200:
 *         description: 메시지 전송 성공
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: "메시지가 성공적으로 전송되었습니다."
 *       400:
 *         description: 잘못된 요청 (필수 필드 누락)
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       500:
 *         description: 서버 오류
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.post('/contact', async (req, res) => {
    try {
        const { name, email, subject, message } = req.body;
        
        logger.info('연락처 폼 제출', {
            name,
            email,
            subject: subject || '제목 없음',
            messageLength: message ? message.length : 0,
            ip: req.ip,
            userAgent: req.headers['user-agent']
        });
        
        if (!name || !email || !message) {
            logger.warn('연락처 폼 검증 실패 - 필수 항목 누락', {
                name: !!name,
                email: !!email,
                message: !!message,
                ip: req.ip
            });
            return res.status(400).json({
                success: false,
                message: '이름, 이메일, 메시지는 필수입니다.'
            });
        }

        // 이메일 형식 검증
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            logger.warn('연락처 폼 검증 실패 - 잘못된 이메일 형식', {
                email,
                ip: req.ip
            });
            return res.status(400).json({
                success: false,
                message: '올바른 이메일 형식이 아닙니다.'
            });
        }

        const ip_address = req.ip || req.connection.remoteAddress;
        const user_agent = req.headers['user-agent'];

        const id = await ContactMessages.create({
            name,
            email,
            subject,
            message,
            ip_address,
            user_agent
        });

        logger.info('연락처 메시지 생성 성공', {
            messageId: id,
            email,
            ip: req.ip
        });

        res.status(201).json({
            success: true,
            message: '메시지가 성공적으로 전송되었습니다.',
            data: { id }
        });
    } catch (error) {
        logger.error('연락처 메시지 생성 실패', {
            error: error.message,
            stack: error.stack,
            ip: req.ip,
            formData: { name: req.body.name, email: req.body.email }
        });
        res.status(500).json({
            success: false,
            message: '메시지 전송에 실패했습니다.'
        });
    }
});

/**
 * @swagger
 * /api/settings:
 *   get:
 *     summary: 공개 설정 조회
 *     description: 웹사이트의 공개 설정 정보를 조회합니다.
 *     tags: [Public]
 *     responses:
 *       200:
 *         description: 설정 조회 성공
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: object
 *                   properties:
 *                     site_title:
 *                       type: string
 *                       example: "승우의 포트폴리오"
 *                     site_description:
 *                       type: string
 *                       example: "웹 개발자 승우의 포트폴리오"
 *                     contact_email:
 *                       type: string
 *                       example: "contact@example.com"
 *       500:
 *         description: 서버 오류
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.get('/settings', async (req, res) => {
    try {
        const settings = await SiteSettings.getAll(true); // 공개 설정만
        
        // 객체 형태로 변환
        const settingsObj = settings.reduce((acc, setting) => {
            let value = setting.setting_value;
            
            // 타입에 따라 값 변환
            if (setting.setting_type === 'boolean') {
                value = value === 'true';
            } else if (setting.setting_type === 'number') {
                value = Number(value);
            } else if (setting.setting_type === 'json') {
                try {
                    value = JSON.parse(value);
                } catch (e) {
                    value = setting.setting_value;
                }
            }
            
            acc[setting.setting_key] = value;
            return acc;
        }, {});

        res.json({
            success: true,
            data: settingsObj
        });
    } catch (error) {
        logger.error('Settings fetch error:', error);
        res.status(500).json({
            success: false,
            message: '설정 정보를 가져오는데 실패했습니다.'
        });
    }
});

// RSS 피드 생성
router.get('/rss.xml', async (req, res) => {
  try {
    // 사이트 설정 가져오기
    const [settings] = await SiteSettings.getPublicSettings(); // SiteSettings.getPublicSettings 사용
    const siteSettings = {};
    settings.forEach(setting => {
      siteSettings[setting.setting_key] = setting.setting_value;
    });

    // 블로그 포스트 가져오기 (최근 20개)
    const [posts] = await BlogPosts.getAll(20, 0, true); // BlogPosts.getAll 사용

    // RSS XML 생성
    const rssXml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>${siteSettings.site_title || '승우 포트폴리오'}</title>
    <link>${req.protocol}://${req.get('host')}</link>
    <description>${siteSettings.site_description || '웹 개발자 승우의 포트폴리오'}</description>
    <language>ko</language>
    <lastBuildDate>${new Date().toUTCString()}</lastBuildDate>
    <atom:link href="${req.protocol}://${req.get('host')}/rss.xml" rel="self" type="application/rss+xml" />
    ${posts.map(post => `
    <item>
      <title><![CDATA[${post.title}]]></title>
      <link>${req.protocol}://${req.get('host')}/blog/${post.slug}</link>
      <guid>${req.protocol}://${req.get('host')}/blog/${post.slug}</guid>
      <description><![CDATA[${post.excerpt || post.title}]]></description>
      <pubDate>${new Date(post.created_at).toUTCString()}</pubDate>
      <category>블로그</category>
    </item>
    `).join('')}
  </channel>
</rss>`;

    res.set('Content-Type', 'application/xml');
    res.send(rssXml);
  } catch (error) {
    logger.error('RSS 피드 생성 실패:', error);
    res.status(500).send('RSS 피드 생성에 실패했습니다.');
  }
});

// 🏷️ 통합 태그 라우트
router.get('/tags', async (req, res) => {
    try {
        const { type, popular } = req.query; // type: blog|project|general
        let tags;
        if (popular === 'true') {
            tags = await Tags.getPopular(20, { type });
        } else {
            tags = await Tags.getAll({ type });
        }
        res.json({ success: true, data: tags });
    } catch (error) {
        logger.error('Tags fetch error:', error);
        res.status(500).json({ success: false, message: '태그 정보를 가져오는데 실패했습니다.' });
    }
});

// 상위 10개 기술 스택 (사용 횟수 기준)
router.get('/tags/top-skills', async (req, res) => {
    try {
        const topSkills = await Tags.getTopSkills(10, 'general');
        res.json({ success: true, data: topSkills });
    } catch (error) {
        logger.error('Top skills fetch error:', error);
        res.status(500).json({ success: false, message: '상위 기술 스택을 가져오는데 실패했습니다.' });
    }
});

// 태그 단건 조회
router.get('/tags/:slug', async (req, res) => {
    try {
        const tag = await Tags.getBySlug(req.params.slug);
        if (!tag) {
            return res.status(404).json({ success: false, message: '태그를 찾을 수 없습니다.' });
        }
        res.json({ success: true, data: tag });
    } catch (error) {
        logger.error('Tag fetch error:', error);
        res.status(500).json({ success: false, message: '태그 정보를 가져오는데 실패했습니다.' });
    }
});

// 과거 호환용 블로그 태그 라우트
router.get('/blog/tags', async (req, res) => {
    try {
        const { popular } = req.query;
        let tags;
        
        if (popular === 'true') {
            tags = await BlogTags.getPopular(10);
        } else {
            tags = await BlogTags.getAll();
        }

        res.json({
            success: true,
            data: tags
        });
    } catch (error) {
        logger.error('Blog tags fetch error:', error);
        res.status(500).json({
            success: false,
            message: '태그 정보를 가져오는데 실패했습니다.'
        });
    }
});

router.get('/blog/posts/tag/:tagSlug', async (req, res) => {
    try {
        const { limit, page } = req.query;
        const pageLimit = parseInt(limit) || 10;
        const offset = page ? (parseInt(page) - 1) * pageLimit : 0;
        
        const posts = await BlogPosts.getByTag(req.params.tagSlug, pageLimit, offset);
        const tag = await Tags.getBySlug(req.params.tagSlug);

        res.json({
            success: true,
            data: posts,
            tag: tag,
            pagination: {
                page: parseInt(page) || 1,
                limit: pageLimit,
                total: posts.length
            }
        });
    } catch (error) {
        logger.error('Blog posts by tag fetch error:', error);
        res.status(500).json({
            success: false,
            message: '태그별 포스트를 가져오는데 실패했습니다.'
        });
    }
});

// 💼 경력/경험 라우트
router.get('/experiences', async (req, res) => {
    try {
        const { type } = req.query;
        let experiences;
        
        if (type) {
            experiences = await Experiences.getByType(type);
        } else {
            experiences = await Experiences.getAll();
        }

        res.json({
            success: true,
            data: experiences
        });
    } catch (error) {
        logger.error('Experiences fetch error:', error);
        res.status(500).json({
            success: false,
            message: '경력 정보를 가져오는데 실패했습니다.'
        });
    }
});

router.get('/experiences/timeline', async (req, res) => {
    try {
        const timeline = await Experiences.getTimeline();
        res.json({
            success: true,
            data: timeline
        });
    } catch (error) {
        logger.error('Timeline fetch error:', error);
        res.status(500).json({
            success: false,
            message: '타임라인 정보를 가져오는데 실패했습니다.'
        });
    }
});

router.post('/experiences', async (req, res) => {
    try {
        const { type, title } = req.body;
        
        if (!type || !title) {
            return res.status(400).json({
                success: false,
                message: '타입과 제목은 필수입니다.'
            });
        }

        // 프론트엔드 필드명을 서버 필드명으로 매핑
        const mappedData = {
            ...req.body,
            company_or_institution: req.body.company || req.body.company_or_institution
        };

        const id = await Experiences.create(mappedData);
        const newExperience = await Experiences.getById(id);

        res.status(201).json({
            success: true,
            message: '경력이 추가되었습니다.',
            data: newExperience
        });
    } catch (error) {
        logger.error('Experience creation error:', error);
        res.status(500).json({
            success: false,
            message: '경력 추가에 실패했습니다.'
        });
    }
});

// 경험 수정
router.put('/experiences/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const { type, title } = req.body;
        
        if (!type || !title) {
            return res.status(400).json({
                success: false,
                message: '타입과 제목은 필수입니다.'
            });
        }

        // 프론트엔드 필드명을 서버 필드명으로 매핑
        const mappedData = {
            ...req.body,
            company_or_institution: req.body.company || req.body.company_or_institution
        };

        const updatedExperience = await Experiences.update(id, mappedData);

        res.json({
            success: true,
            message: '경력이 수정되었습니다.',
            data: updatedExperience
        });
    } catch (error) {
        logger.error('Experience update error:', error);
        res.status(500).json({
            success: false,
            message: '경력 수정에 실패했습니다.'
        });
    }
});

// 경험 삭제
router.delete('/experiences/:id', async (req, res) => {
    try {
        const { id } = req.params;
        await Experiences.delete(id);

        res.json({
            success: true,
            message: '경력이 삭제되었습니다.'
        });
    } catch (error) {
        logger.error('Experience deletion error:', error);
        res.status(500).json({
            success: false,
            message: '경력 삭제에 실패했습니다.'
        });
    }
});

// 🎯 관심사 라우트
router.get('/interests', async (req, res) => {
    try {
        const { category } = req.query;
        let interests;
        
        if (category) {
            interests = await Interests.getByCategory(category);
        } else {
            interests = await Interests.getAll();
        }

        res.json({
            success: true,
            data: interests
        });
    } catch (error) {
        logger.error('Interests fetch error:', error);
        res.status(500).json({
            success: false,
            message: '관심사 정보를 가져오는데 실패했습니다.'
        });
    }
});

// 관심사 생성
router.post('/interests', async (req, res) => {
    try {
        const interest = await Interests.create(req.body);
        res.json({
            success: true,
            message: '관심사가 생성되었습니다.',
            data: interest
        });
    } catch (error) {
        logger.error('Interest creation error:', error);
        res.status(500).json({
            success: false,
            message: '관심사 생성에 실패했습니다.'
        });
    }
});

// 관심사 수정
router.put('/interests/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const interest = await Interests.update(id, req.body);
        res.json({
            success: true,
            message: '관심사가 수정되었습니다.',
            data: interest
        });
    } catch (error) {
        logger.error('Interest update error:', error);
        res.status(500).json({
            success: false,
            message: '관심사 수정에 실패했습니다.'
        });
    }
});

// 관심사 삭제
router.delete('/interests/:id', async (req, res) => {
    try {
        const { id } = req.params;
        await Interests.delete(id);
        res.json({
            success: true,
            message: '관심사가 삭제되었습니다.'
        });
    } catch (error) {
        logger.error('Interest deletion error:', error);
        res.status(500).json({
            success: false,
            message: '관심사 삭제에 실패했습니다.'
        });
    }
});

// 📊 대시보드/통계 라우트
router.get('/dashboard/stats', async (req, res) => {
    try {
        const [projectCount, blogCount, contactStats, skillCount] = await Promise.all([
            executeQuery('SELECT COUNT(*) as count FROM projects'),
            executeQuery('SELECT COUNT(*) as count FROM blog_posts WHERE is_published = TRUE'),
            ContactMessages.getStats(),
            executeQuery('SELECT COUNT(*) as count FROM skills')
        ]);

        res.json({
            success: true,
            data: {
                projects: projectCount[0].count,
                blogPosts: blogCount[0].count,
                skills: skillCount[0].count,
                contacts: contactStats
            }
        });
    } catch (error) {
        logger.error('Dashboard stats error:', error);
        res.status(500).json({
            success: false,
            message: '통계 정보를 가져오는데 실패했습니다.'
        });
    }
});

// 🔍 통합 검색 라우트
router.get('/search', async (req, res) => {
    try {
        const { q, type } = req.query;
        
        if (!q) {
            return res.status(400).json({
                success: false,
                message: '검색어를 입력해주세요.'
            });
        }

        const results = {};

        if (!type || type === 'all' || type === 'blog') {
            results.blogPosts = await BlogPosts.search(q, 5);
        }

        if (!type || type === 'all' || type === 'projects') {
            const projectResults = await executeQuery(`
                SELECT p.*, 
                       GROUP_CONCAT(DISTINCT s.name) as skills,
                       GROUP_CONCAT(DISTINCT t.name) as tags
                FROM projects p
                LEFT JOIN project_skills ps ON p.id = ps.project_id
                LEFT JOIN skills s ON ps.skill_id = s.id
                LEFT JOIN tag_usage tu ON tu.content_type = 'project' AND tu.content_id = p.id
                LEFT JOIN tags t ON tu.tag_id = t.id
                WHERE p.title LIKE ? OR p.description LIKE ? OR s.name LIKE ?
                GROUP BY p.id
                LIMIT 5
            `, [`%${q}%`, `%${q}%`, `%${q}%`]);
            
            results.projects = projectResults.map(project => ({
                ...project,
                skills: project.skills ? project.skills.split(',') : []
                ,tags: project.tags ? project.tags.split(',') : []
            }));
        }

        if (!type || type === 'all' || type === 'skills') {
            results.skills = await executeQuery(`
                SELECT s.*, sc.name as category_name
                FROM skills s
                LEFT JOIN skill_categories sc ON s.category_id = sc.id
                WHERE s.name LIKE ?
                LIMIT 5
            `, [`%${q}%`]);
        }

        res.json({
            success: true,
            data: results,
            query: q
        });
    } catch (error) {
        logger.error('Search error:', error);
        res.status(500).json({
            success: false,
            message: '검색에 실패했습니다.'
        });
    }
});

// 🏥 헬스 체크
router.get('/health', async (req, res) => {
    try {
        // 간단한 DB 연결 테스트
        await executeQuery('SELECT 1');
        
        res.json({
            success: true,
            message: 'Portfolio API is healthy',
            timestamp: new Date().toISOString(),
            database: 'connected'
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Health check failed',
            timestamp: new Date().toISOString(),
            database: 'disconnected'
        });
    }
});

// 📊 프로젝트 조회수 증가 (슬러그 기반)
router.post('/projects/slug/:slug/view', async (req, res) => {
    try {
        const projectSlug = req.params.slug;
        
        // 프로젝트 존재 여부 확인 (슬러그로)
        const project = await executeQuery('SELECT id FROM projects WHERE slug = ?', [projectSlug]);
        
        if (project.length === 0) {
            return res.status(404).json({
                success: false,
                message: '프로젝트를 찾을 수 없습니다.'
            });
        }
        
        // 조회수 증가
        await executeQuery('UPDATE projects SET view_count = view_count + 1 WHERE id = ?', [project[0].id]);
        
        res.json({
            success: true,
            message: '조회수가 증가되었습니다.'
        });
    } catch (error) {
        logger.error('프로젝트 조회수 증가 실패:', error);
        res.status(500).json({
            success: false,
            message: '조회수 증가에 실패했습니다.'
        });
    }
});

// 👤 관리자용 개인정보 라우트
router.get('/admin/personal-info', 
    authenticateToken, 
    requirePermission('personal_info.read'),
    async (req, res) => {
        try {
            const info = await PersonalInfo.get();
            res.json({
                success: true,
                data: info || {} // 데이터가 없으면 빈 객체 반환
            });
        } catch (error) {
            logger.error('Admin personal info fetch error:', error);
            res.status(500).json({
                success: false,
                message: '개인 정보를 가져오는데 실패했습니다.'
            });
        }
    }
);

router.put('/admin/personal-info', 
    authenticateToken, 
    requirePermission('personal_info.update'),
    logActivity('update_personal_info'),
    async (req, res) => {
        try {
            // undefined 값을 null로 변환
            const cleanedData = Object.fromEntries(
                Object.entries(req.body).map(([key, value]) => [
                    key, 
                    (value === undefined || value === '') ? null : value
                ])
            );
            
            const result = await PersonalInfo.update(cleanedData);
            
            // 🔄 개인정보 → 설정 자동 동기화
            try {
                const syncSettings = {};
                
                // 개인정보 필드를 설정 필드로 매핑
                if (cleanedData.name) syncSettings.personal_name = cleanedData.name;
                if (cleanedData.full_name) syncSettings.personal_name = cleanedData.full_name;
                if (cleanedData.title) syncSettings.personal_title = cleanedData.title;
                if (cleanedData.bio) syncSettings.personal_bio = cleanedData.bio;
                if (cleanedData.about) syncSettings.personal_about = cleanedData.about;
                if (cleanedData.location) syncSettings.personal_location = cleanedData.location;
                if (cleanedData.email) syncSettings.personal_email = cleanedData.email;
                if (cleanedData.phone) syncSettings.personal_phone = cleanedData.phone;
                if (cleanedData.avatar_url) syncSettings.personal_avatar_url = cleanedData.avatar_url;
                if (cleanedData.resume_url) syncSettings.personal_resume_url = cleanedData.resume_url;
                if (cleanedData.github_url) syncSettings.personal_github_url = cleanedData.github_url;
                if (cleanedData.linkedin_url) syncSettings.personal_linkedin_url = cleanedData.linkedin_url;
                if (cleanedData.twitter_url) syncSettings.personal_twitter_url = cleanedData.twitter_url;
                if (cleanedData.instagram_url) syncSettings.personal_instagram_url = cleanedData.instagram_url;
                
                // 설정이 변경된 경우에만 업데이트
                if (Object.keys(syncSettings).length > 0) {
                    await SiteSettings.updateSettings(syncSettings);
                    logger.info('개인정보 → 설정 자동 동기화 완료', { syncedFields: Object.keys(syncSettings) });
                }
            } catch (syncError) {
                logger.warn('개인정보 → 설정 동기화 실패', { error: syncError.message });
                // 동기화 실패해도 개인정보 업데이트는 성공으로 처리
            }
            
            // PersonalInfo.update()는 업데이트된 데이터를 반환하므로 직접 사용
            res.json({
                success: true,
                message: '개인 정보가 저장되었습니다.',
                data: result
            });
        } catch (error) {
            logger.error('Admin personal info update error:', error);
            res.status(500).json({
                success: false,
                message: '개인 정보 저장에 실패했습니다.'
            });
        }
    }
);

module.exports = router;
