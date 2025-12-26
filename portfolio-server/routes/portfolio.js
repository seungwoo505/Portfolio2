/**
 * @swagger
 * components:
 *   schemas:
 *     PersonalInfo:
 *       type: object
 *       properties:
 *         name:
 *           type: string
 *           example: "승우"
 *         full_name:
 *           type: string
 *           example: "홍 승우"
 *         title:
 *           type: string
 *           example: "Full-stack Developer"
 *         bio:
 *           type: string
 *           example: "웹과 모바일을 모두 아우르는 개발자입니다."
 *         about:
 *           type: string
 *           example: "10년차 개발자로..."
 *         email:
 *           type: string
 *           format: email
 *           example: "me@example.com"
 *         phone:
 *           type: string
 *           example: "+82-10-1234-5678"
 *         location:
 *           type: string
 *           example: "Seoul, South Korea"
 *         avatar_url:
 *           type: string
 *           format: uri
 *           example: "https://example.com/avatar.jpg"
 *         resume_url:
 *           type: string
 *           format: uri
 *           example: "https://example.com/resume.pdf"
 *         github_url:
 *           type: string
 *           format: uri
 *           example: "https://github.com/username"
 *         linkedin_url:
 *           type: string
 *           format: uri
 *           example: "https://www.linkedin.com/in/username/"
 *         twitter_url:
 *           type: string
 *           format: uri
 *           example: "https://twitter.com/username"
 *         instagram_url:
 *           type: string
 *           format: uri
 *           example: "https://instagram.com/username"
 *         updated_at:
 *           type: string
 *           format: date-time
 *           example: "2024-01-15T10:30:00Z"
 *     SocialLink:
 *       type: object
 *       properties:
 *         id:
 *           type: integer
 *           example: 1
 *         platform:
 *           type: string
 *           example: "GitHub"
 *         url:
 *           type: string
 *           format: uri
 *           example: "https://github.com/username"
 *         icon:
 *           type: string
 *           example: "github"
 *         display_order:
 *           type: integer
 *           example: 1
 *         is_active:
 *           type: boolean
 *           example: true
 *         created_at:
 *           type: string
 *           format: date-time
 *           example: "2024-01-15T10:30:00Z"
 *         updated_at:
 *           type: string
 *           format: date-time
 *           example: "2024-01-16T10:30:00Z"
 *     Skill:
 *       type: object
 *       properties:
 *         id:
 *           type: integer
 *           example: 1
 *         name:
 *           type: string
 *           example: "TypeScript"
 *         category_id:
 *           type: integer
 *           example: 2
 *         category_name:
 *           type: string
 *           example: "Frontend"
 *         proficiency_level:
 *           type: integer
 *           minimum: 0
 *           maximum: 100
 *           example: 90
 *         years_of_experience:
 *           type: number
 *           example: 5
 *         icon:
 *           type: string
 *           example: "logos:typescript-icon"
 *         color:
 *           type: string
 *           example: "#3178C6"
 *         display_order:
 *           type: integer
 *           example: 1
 *         is_featured:
 *           type: boolean
 *           example: true
 *         created_at:
 *           type: string
 *           format: date-time
 *           example: "2024-01-15T10:30:00Z"
 *         updated_at:
 *           type: string
 *           format: date-time
 *           example: "2024-01-16T10:30:00Z"
 *     SkillCategory:
 *       type: object
 *       properties:
 *         id:
 *           type: integer
 *           example: 1
 *         name:
 *           type: string
 *           example: "Frontend"
 *         display_order:
 *           type: integer
 *           example: 1
 *     Tag:
 *       type: object
 *       properties:
 *         id:
 *           type: integer
 *           example: 1
 *         name:
 *           type: string
 *           example: "Next.js"
 *         slug:
 *           type: string
 *           example: "nextjs"
 *         description:
 *           type: string
 *           example: "Next.js 관련 콘텐츠"
 *         color:
 *           type: string
 *           example: "#000000"
 *         type:
 *           type: string
 *           example: "blog"
 *         usage_count:
 *           type: integer
 *           example: 12
 *     Experience:
 *       type: object
 *       properties:
 *         id:
 *           type: integer
 *           example: 1
 *         type:
 *           type: string
 *           example: "work"
 *         title:
 *           type: string
 *           example: "Senior Developer"
 *         company:
 *           type: string
 *           example: "Awesome Corp"
 *         location:
 *           type: string
 *           example: "Seoul"
 *         description:
 *           type: string
 *           example: "프로젝트 리드 및 아키텍처 설계"
 *         start_date:
 *           type: string
 *           format: date
 *           example: "2022-01-01"
 *         end_date:
 *           type: string
 *           format: date
 *           nullable: true
 *           example: "2024-06-30"
 *         is_current:
 *           type: boolean
 *           example: false
 *         display_order:
 *           type: integer
 *           example: 1
 *     Interest:
 *       type: object
 *       properties:
 *         id:
 *           type: integer
 *           example: 1
 *         title:
 *           type: string
 *           example: "Machine Learning"
 *         description:
 *           type: string
 *           example: "ML 연구와 모델 구축"
 *         category:
 *           type: string
 *           example: "study"
 *         display_order:
 *           type: integer
 *           example: 1
 *     PublicSettings:
 *       type: object
 *       description: "공개 가능한 사이트 설정"
 *       example:
 *         site_title: "승우의 포트폴리오"
 *         site_description: "웹 개발자 승우의 포트폴리오"
 *         contact_email: "contact@example.com"
 *         show_blog: true
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
 *           description: "태그 이름 배열"
 *           items:
 *             type: string
 *             example: "Next.js"
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
 *           description: "프로젝트 상태 (예: completed, draft)"
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
 *           description: "태그 이름 배열"
 *           items:
 *             type: string
 *             example: "React"
 *         skills:
 *           type: array
 *           description: "관련 기술 이름 배열"
 *           items:
 *             type: string
 *             example: "TypeScript"
 *         images:
 *           type: array
 *           description: "프로젝트 이미지 URL 배열"
 *           items:
 *             type: string
 *             format: uri
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

const { authenticateToken, requirePermission, logActivity } = require('../middleware/auth');

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
 * @swagger
 * /api/personal-info:
 *   get:
 *     summary: 개인 정보 조회
 *     tags: [Profile]
 *     responses:
 *       200:
 *         description: 개인 정보 조회 성공
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   $ref: '#/components/schemas/PersonalInfo'
 *       500:
 *         description: 서버 오류
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *   put:
 *     summary: 개인 정보 수정
 *     tags: [Profile]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/PersonalInfo'
 *     responses:
 *       200:
 *         description: 개인 정보 수정 성공
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
 *                   example: "개인 정보가 업데이트되었습니다."
 *                 data:
 *                   $ref: '#/components/schemas/PersonalInfo'
 *       500:
 *         description: 서버 오류
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 * /api/social-links:
 *   get:
 *     summary: 소셜 링크 목록 조회
 *     tags: [Social]
 *     responses:
 *       200:
 *         description: 소셜 링크 목록 조회 성공
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
 *                     $ref: '#/components/schemas/SocialLink'
 *       500:
 *         description: 서버 오류
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *   post:
 *     summary: 소셜 링크 추가
 *     tags: [Social]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - platform
 *               - url
 *             properties:
 *               platform:
 *                 type: string
 *                 example: "GitHub"
 *               url:
 *                 type: string
 *                 format: uri
 *                 example: "https://github.com/username"
 *               icon:
 *                 type: string
 *                 example: "github"
 *               display_order:
 *                 type: integer
 *                 example: 1
 *     responses:
 *       201:
 *         description: 소셜 링크 생성 성공
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
 *                   example: "소셜 링크가 추가되었습니다."
 *                 data:
 *                   $ref: '#/components/schemas/SocialLink'
 *       400:
 *         description: 잘못된 요청
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

/**
 * @swagger
 * /api/skills:
 *   get:
 *     summary: 기술 및 카테고리 조회
 *     tags: [Skills]
 *     responses:
 *       200:
 *         description: 기술 목록 조회 성공
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
 *                     skills:
 *                       type: array
 *                       items:
 *                         $ref: '#/components/schemas/Skill'
 *                     categories:
 *                       type: array
 *                       items:
 *                         $ref: '#/components/schemas/SkillCategory'
 *                     skillsByCategory:
 *                       type: array
 *                       items:
 *                         allOf:
 *                           - $ref: '#/components/schemas/SkillCategory'
 *                           - type: object
 *                             properties:
 *                               skills:
 *                                 type: array
 *                                 items:
 *                                   $ref: '#/components/schemas/Skill'
 *       500:
 *         description: 서버 오류
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *   post:
 *     summary: 기술 추가
 *     tags: [Skills]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - name
 *             properties:
 *               category_id:
 *                 type: integer
 *                 example: 1
 *               name:
 *                 type: string
 *                 example: "TypeScript"
 *               proficiency_level:
 *                 type: integer
 *                 example: 90
 *               years_of_experience:
 *                 type: number
 *                 example: 5
 *               icon:
 *                 type: string
 *                 example: "logos:typescript-icon"
 *               color:
 *                 type: string
 *                 example: "#3178C6"
 *               display_order:
 *                 type: integer
 *                 example: 1
 *               is_featured:
 *                 type: boolean
 *                 example: true
 *     responses:
 *       201:
 *         description: 기술 생성 성공
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
 *                   example: "스킬이 추가되었습니다."
 *                 data:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: integer
 *                       example: 12
 *       400:
 *         description: 잘못된 요청
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
 * /api/skills/featured:
 *   get:
 *     summary: 주요 기술 조회
 *     tags: [Skills]
 *     responses:
 *       200:
 *         description: 주요 기술 목록 조회 성공
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
 *                     $ref: '#/components/schemas/Skill'
 *       500:
 *         description: 서버 오류
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.get('/skills', async (req, res) => {
    try {
        const skills = await Skills.getAllWithCategories();
        const categories = await Skills.getCategories();
        
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
 *         description: 태그 슬러그 필터 (쉼표로 구분)
 *       - in: query
 *         name: skills
 *         schema:
 *           type: string
 *         description: 기술 이름 필터 (쉼표로 구분)
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [published, draft]
 *           default: published
 *         description: 게시 상태 필터
 *       - in: query
 *         name: sort
 *         schema:
 *           type: string
 *           enum: [created_at, title, view_count, display_order]
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
            filters.offset = 0;
            projects = await Projects.getWithFilters(filters);
            totalCount = await Projects.getCountWithFilters({ ...filters, limit: 1000, offset: 0 });
        } else {
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

/**
 * @swagger
 * /api/projects/slug/{slug}:
 *   get:
 *     summary: 프로젝트 상세 조회
 *     tags: [Projects]
 *     parameters:
 *       - in: path
 *         name: slug
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: 프로젝트 조회 성공
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   $ref: '#/components/schemas/Project'
 *       404:
 *         description: 프로젝트 없음
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

/**
 * @swagger
 * /api/projects/tag/{tagSlug}:
 *   get:
 *     summary: 태그별 프로젝트 목록 조회
 *     tags: [Projects, Tags]
 *     parameters:
 *       - in: path
 *         name: tagSlug
 *         required: true
 *         schema:
 *           type: string
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 10
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *     responses:
 *       200:
 *         description: 태그별 프로젝트 조회 성공
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
 *                     page:
 *                       type: integer
 *                       example: 1
 *                     limit:
 *                       type: integer
 *                       example: 10
 *                     total:
 *                       type: integer
 *                       example: 3
 *       500:
 *         description: 서버 오류
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
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
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *         description: 페이지 번호
 *       - in: query
 *         name: featured
 *         schema:
 *           type: boolean
 *         description: 추천 포스트만 조회
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *         description: 검색 키워드
 *       - in: query
 *         name: tags
 *         schema:
 *           type: string
 *         description: 태그 슬러그 필터 (쉼표 구분)
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [published, draft]
 *           default: published
 *         description: 게시 상태 지정
 *       - in: query
 *         name: sort
 *         schema:
 *           type: string
 *           enum: [published_at, created_at, title, view_count, reading_time]
 *           default: published_at
 *         description: 정렬 컬럼
 *       - in: query
 *         name: order
 *         schema:
 *           type: string
 *           enum: [asc, desc]
 *           example: "desc"
 *         description: 정렬 순서
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
 *                     page:
 *                       type: integer
 *                       example: 1
 *                     limit:
 *                       type: integer
 *                       example: 10
 *                     total:
 *                       type: integer
 *                       example: 25
 *                     totalPages:
 *                       type: integer
 *                       example: 3
 *       500:
 *         description: 서버 오류
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *   post:
 *     summary: 블로그 포스트 생성
 *     tags: [Blog]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - title
 *               - content
 *             properties:
 *               title:
 *                 type: string
 *                 example: "새로운 Next.js 기능"
 *               content:
 *                 type: string
 *                 example: "# Next.js 15 살펴보기"
 *               excerpt:
 *                 type: string
 *                 example: "주요 기능 요약"
 *               tags:
 *                 type: array
 *                 items:
 *                   type: string
 *               is_published:
 *                 type: boolean
 *                 example: true
 *     responses:
 *       201:
 *         description: 블로그 포스트 생성 성공
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
 *                   example: "블로그 포스트가 생성되었습니다."
 *                 data:
 *                   $ref: '#/components/schemas/BlogPost'
 *       400:
 *         description: 잘못된 요청
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
 * /api/blog/posts/{slug}:
 *   get:
 *     summary: 블로그 포스트 상세 조회
 *     tags: [Blog]
 *     parameters:
 *       - in: path
 *         name: slug
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: 포스트 조회 성공
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   $ref: '#/components/schemas/BlogPost'
 *       404:
 *         description: 포스트 없음
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 * /api/blog/search:
 *   get:
 *     summary: 블로그 포스트 검색
 *     tags: [Blog]
 *     parameters:
 *       - in: query
 *         name: q
 *         required: true
 *         schema:
 *           type: string
 *         description: 검색어
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 10
 *     responses:
 *       200:
 *         description: 검색 성공
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
 *                 query:
 *                   type: string
 *                   example: "Next.js"
 *       400:
 *         description: 검색어 누락
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 * /api/blog/posts/{slug}/view:
 *   post:
 *     summary: 블로그 포스트 조회수 증가
 *     tags: [Blog]
 *     parameters:
 *       - in: path
 *         name: slug
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: 조회수 증가 성공
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
 *                   example: "조회수가 증가되었습니다."
 *       404:
 *         description: 포스트 없음
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
            filters.offset = 0;
            posts = await BlogPosts.getWithFilters(filters);
            totalCount = await BlogPosts.getCountWithFilters({ ...filters, limit: 1000, offset: 0 });
        } else {
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

router.post('/blog/posts/:slug/view', async (req, res) => {
    try {
        const postSlug = req.params.slug;
        
        const post = await executeQuery('SELECT id FROM blog_posts WHERE slug = ? AND is_published = TRUE', [postSlug]);
        
        if (!post || post.length === 0) {
            return res.status(404).json({
                success: false,
                message: '블로그 포스트를 찾을 수 없습니다.'
            });
        }

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
 *       201:
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
 *     tags: [Settings]
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
 *                   $ref: '#/components/schemas/PublicSettings'
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
        
        const settingsObj = settings.reduce((acc, setting) => {
            let value = setting.setting_value;
            
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

/**
 * @swagger
 * /api/rss.xml:
 *   get:
 *     summary: 블로그 RSS 피드
 *     tags: [Blog]
 *     produces:
 *       - application/xml
 *     responses:
 *       200:
 *         description: 최신 블로그 포스트 RSS 피드
 *         content:
 *           application/xml:
 *             schema:
 *               type: string
 *       500:
 *         description: 서버 오류
 */
router.get('/rss.xml', async (req, res) => {
  try {
    const [settings] = await SiteSettings.getPublicSettings(); // SiteSettings.getPublicSettings 사용
    const siteSettings = {};
    settings.forEach(setting => {
      siteSettings[setting.setting_key] = setting.setting_value;
    });

    const [posts] = await BlogPosts.getAll(20, 0, true); // BlogPosts.getAll 사용

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

/**
 * @swagger
 * /api/tags:
 *   get:
 *     summary: 태그 목록 조회
 *     tags: [Tags]
 *     parameters:
 *       - in: query
 *         name: type
 *         schema:
 *           type: string
 *           enum: [blog, project, general]
 *         description: 태그 분류 필터
 *       - in: query
 *         name: popular
 *         schema:
 *           type: boolean
 *         description: 인기 태그만 조회
 *     responses:
 *       200:
 *         description: 태그 목록 조회 성공
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
 *                     $ref: '#/components/schemas/Tag'
 *       500:
 *         description: 서버 오류
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 * /api/tags/top-skills:
 *   get:
 *     summary: 상위 기술 태그 조회
 *     tags: [Tags]
 *     responses:
 *       200:
 *         description: 상위 기술 태그 조회 성공
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
 *                     $ref: '#/components/schemas/Tag'
 *       500:
 *         description: 서버 오류
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 * /api/tags/{slug}:
 *   get:
 *     summary: 태그 상세 조회
 *     tags: [Tags]
 *     parameters:
 *       - in: path
 *         name: slug
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: 태그 조회 성공
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   $ref: '#/components/schemas/Tag'
 *       404:
 *         description: 태그 없음
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 * /api/blog/tags:
 *   get:
 *     summary: 블로그 태그 조회
 *     tags: [Tags]
 *     parameters:
 *       - in: query
 *         name: popular
 *         schema:
 *           type: boolean
 *         description: 인기 태그만 조회
 *     responses:
 *       200:
 *         description: 블로그 태그 조회 성공
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
 *                     $ref: '#/components/schemas/Tag'
 *       500:
 *         description: 서버 오류
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 * /api/blog/posts/tag/{tagSlug}:
 *   get:
 *     summary: 태그별 블로그 포스트 조회
 *     tags: [Blog, Tags]
 *     parameters:
 *       - in: path
 *         name: tagSlug
 *         required: true
 *         schema:
 *           type: string
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 10
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *     responses:
 *       200:
 *         description: 태그별 포스트 조회 성공
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
 *                 tag:
 *                   $ref: '#/components/schemas/Tag'
 *                 pagination:
 *                   type: object
 *                   properties:
 *                     page:
 *                       type: integer
 *                       example: 1
 *                     limit:
 *                       type: integer
 *                       example: 10
 *                     total:
 *                       type: integer
 *                       example: 10
 *       500:
 *         description: 서버 오류
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
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

router.get('/tags/top-skills', async (req, res) => {
    try {
        const topSkills = await Tags.getTopSkills(10, 'general');
        res.json({ success: true, data: topSkills });
    } catch (error) {
        logger.error('Top skills fetch error:', error);
        res.status(500).json({ success: false, message: '상위 기술 스택을 가져오는데 실패했습니다.' });
    }
});

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

/**
 * @swagger
 * /api/experiences:
 *   get:
 *     summary: 경력/경험 목록 조회
 *     tags: [Experiences]
 *     parameters:
 *       - in: query
 *         name: type
 *         schema:
 *           type: string
 *           example: "work"
 *         description: 경력 유형 필터 (work, education 등)
 *     responses:
 *       200:
 *         description: 경력 목록 조회 성공
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
 *                     $ref: '#/components/schemas/Experience'
 *       500:
 *         description: 서버 오류
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *   post:
 *     summary: 경력 추가
 *     tags: [Experiences]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - type
 *               - title
 *             properties:
 *               type:
 *                 type: string
 *                 example: "work"
 *               title:
 *                 type: string
 *                 example: "Senior Developer"
 *               company:
 *                 type: string
 *                 example: "Awesome Corp"
 *               description:
 *                 type: string
 *               start_date:
 *                 type: string
 *                 format: date
 *               end_date:
 *                 type: string
 *                 format: date
 *               is_current:
 *                 type: boolean
 *                 example: false
 *     responses:
 *       201:
 *         description: 경력 추가 성공
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
 *                   example: "경력이 추가되었습니다."
 *                 data:
 *                   $ref: '#/components/schemas/Experience'
 *       400:
 *         description: 잘못된 요청
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
 * /api/experiences/timeline:
 *   get:
 *     summary: 경력 타임라인 조회
 *     tags: [Experiences]
 *     responses:
 *       200:
 *         description: 타임라인 조회 성공
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
 *                     $ref: '#/components/schemas/Experience'
 *       500:
 *         description: 서버 오류
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 * /api/experiences/{id}:
 *   put:
 *     summary: 경력 수정
 *     tags: [Experiences]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - type
 *               - title
 *             properties:
 *               type:
 *                 type: string
 *               title:
 *                 type: string
 *     responses:
 *       200:
 *         description: 경력 수정 성공
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
 *                   example: "경력이 수정되었습니다."
 *                 data:
 *                   $ref: '#/components/schemas/Experience'
 *       400:
 *         description: 잘못된 요청
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       404:
 *         description: 경력 없음
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *   delete:
 *     summary: 경력 삭제
 *     tags: [Experiences]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: 경력 삭제 성공
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
 *                   example: "경력이 삭제되었습니다."
 *       404:
 *         description: 경력 없음
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

/**
 * @swagger
 * /api/interests:
 *   get:
 *     summary: 관심사 목록 조회
 *     tags: [Profile]
 *     parameters:
 *       - in: query
 *         name: category
 *         schema:
 *           type: string
 *           example: "hobby"
 *         description: 관심사 카테고리 필터
 *     responses:
 *       200:
 *         description: 관심사 목록 조회 성공
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
 *                     $ref: '#/components/schemas/Interest'
 *       500:
 *         description: 서버 오류
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *   post:
 *     summary: 관심사 생성
 *     tags: [Profile]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/Interest'
 *     responses:
 *       201:
 *         description: 관심사 생성 성공
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
 *                   example: "관심사가 생성되었습니다."
 *                 data:
 *                   $ref: '#/components/schemas/Interest'
 *       500:
 *         description: 서버 오류
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 * /api/interests/{id}:
 *   put:
 *     summary: 관심사 수정
 *     tags: [Profile]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/Interest'
 *     responses:
 *       200:
 *         description: 관심사 수정 성공
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
 *                   example: "관심사가 수정되었습니다."
 *                 data:
 *                   $ref: '#/components/schemas/Interest'
 *       500:
 *         description: 서버 오류
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *   delete:
 *     summary: 관심사 삭제
 *     tags: [Profile]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: 관심사 삭제 성공
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
 *                   example: "관심사가 삭제되었습니다."
 *       500:
 *         description: 서버 오류
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
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

/**
 * @swagger
 * /api/dashboard/stats:
 *   get:
 *     summary: 공개 대시보드 통계 조회
 *     tags: [Dashboard]
 *     responses:
 *       200:
 *         description: 통계 조회 성공
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
 *                     projects:
 *                       type: integer
 *                       example: 12
 *                     blogPosts:
 *                       type: integer
 *                       example: 34
 *                     skills:
 *                       type: integer
 *                       example: 18
 *                     contacts:
 *                       type: object
 *                       properties:
 *                         total:
 *                           type: integer
 *                           example: 45
 *                         unread:
 *                           type: integer
 *                           example: 2
 *                         unreplied:
 *                           type: integer
 *                           example: 1
 *                         today:
 *                           type: integer
 *                           example: 3
 *                         this_week:
 *                           type: integer
 *                           example: 8
 *                         this_month:
 *                           type: integer
 *                           example: 15
 *       500:
 *         description: 서버 오류
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
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

/**
 * @swagger
 * /api/search:
 *   get:
 *     summary: 통합 검색
 *     tags: [Search]
 *     parameters:
 *       - in: query
 *         name: q
 *         required: true
 *         schema:
 *           type: string
 *         description: 검색어
 *       - in: query
 *         name: type
 *         schema:
 *           type: string
 *           enum: [all, blog, projects, skills]
 *           default: all
 *         description: 검색 대상 범위
 *     responses:
 *       200:
 *         description: 검색 성공
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
 *                     blogPosts:
 *                       type: array
 *                       items:
 *                         $ref: '#/components/schemas/BlogPost'
 *                     projects:
 *                       type: array
 *                       items:
 *                         $ref: '#/components/schemas/Project'
 *                     skills:
 *                       type: array
 *                       items:
 *                         $ref: '#/components/schemas/Skill'
 *                 query:
 *                   type: string
 *                   example: "Next.js"
 *       400:
 *         description: 검색어 누락
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

/**
 * @swagger
 * /api/health:
 *   get:
 *     summary: 서비스 상태 확인
 *     tags: [Health]
 *     responses:
 *       200:
 *         description: 서비스 정상
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
 *                   example: "Portfolio API is healthy"
 *                 timestamp:
 *                   type: string
 *                   format: date-time
 *                 database:
 *                   type: string
 *                   example: "connected"
 *       500:
 *         description: 서비스 오류
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: false
 *                 message:
 *                   type: string
 *                   example: "Health check failed"
 *                 database:
 *                   type: string
 *                   example: "disconnected"
 */
router.get('/health', async (req, res) => {
    try {
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

/**
 * @swagger
 * /api/projects/slug/{slug}/view:
 *   post:
 *     summary: 프로젝트 조회수 증가
 *     tags: [Projects]
 *     parameters:
 *       - in: path
 *         name: slug
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: 조회수 증가 성공
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
 *                   example: "조회수가 증가되었습니다."
 *       404:
 *         description: 프로젝트 없음
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
router.post('/projects/slug/:slug/view', async (req, res) => {
    try {
        const projectSlug = req.params.slug;
        
        const project = await executeQuery('SELECT id FROM projects WHERE slug = ?', [projectSlug]);
        
        if (project.length === 0) {
            return res.status(404).json({
                success: false,
                message: '프로젝트를 찾을 수 없습니다.'
            });
        }
        
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

/**
 * @swagger
 * /api/admin/personal-info:
 *   get:
 *     summary: 관리자용 개인 정보 조회
 *     tags: [Profile]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: 개인 정보 조회 성공
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   $ref: '#/components/schemas/PersonalInfo'
 *       401:
 *         description: 인증 실패
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *   put:
 *     summary: 관리자용 개인 정보 수정
 *     tags: [Profile]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/PersonalInfo'
 *     responses:
 *       200:
 *         description: 개인 정보 저장 성공
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
 *                   example: "개인 정보가 저장되었습니다."
 *                 data:
 *                   $ref: '#/components/schemas/PersonalInfo'
 *       400:
 *         description: 잘못된 요청
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       401:
 *         description: 인증 실패
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
            const cleanedData = Object.fromEntries(
                Object.entries(req.body).map(([key, value]) => [
                    key, 
                    (value === undefined || value === '') ? null : value
                ])
            );
            
            const result = await PersonalInfo.update(cleanedData);
            
            try {
                const syncSettings = {};
                
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
                
                if (Object.keys(syncSettings).length > 0) {
                    await SiteSettings.updateSettings(syncSettings);
                    logger.info('개인정보 → 설정 자동 동기화 완료', { syncedFields: Object.keys(syncSettings) });
                }
            } catch (syncError) {
                logger.warn('개인정보 → 설정 동기화 실패', { error: syncError.message });
            }
            
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
