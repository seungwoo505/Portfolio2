import type { Request, Response, Router } from 'express';

const express = require('express');
const {
    CacheUtils,
    Projects,
    authenticateToken,
    buildErrorLog,
    getPlainBody,
    hasRequiredStringFields,
    logActivity,
    logger,
    normalizeProjectContentFields,
    parsePagination,
    requirePermission,
    toOptionalBoolean,
    trimStringFields,
    verboseDebug
} = require('./common');

const router: Router = express.Router();

/**
 * @swagger
 * /admin/projects:
 *   get:
 *     summary: 관리자 프로젝트 목록 조회
 *     tags:
 *       - Admin - Projects
 *     security:
 *       - bearerAuth: []
 *     description: projects.read 권한이 필요합니다. featured=true는 발행된 추천 프로젝트만 조회합니다. false 또는 생략 시 발행 여부와 무관하게 전체 프로젝트를 조회합니다.
 *     parameters:
 *       - name: limit
 *         in: query
 *         description: 1~100으로 보정합니다. 정수가 아니면 기본값을 사용합니다.
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 100
 *           default: 20
 *       - name: page
 *         in: query
 *         description: 1~10000으로 보정합니다. 정수가 아니면 기본값을 사용합니다.
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 10000
 *           default: 1
 *       - name: featured
 *         in: query
 *         description: true일 때만 추천·발행 프로젝트로 필터링합니다.
 *         schema:
 *           type: boolean
 *     responses:
 *       '200':
 *         description: 프로젝트 목록
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/Success'
 *                 - type: object
 *                   properties:
 *                     data:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           id:
 *                             type: integer
 *                             description: 프로젝트 ID
 *                           title:
 *                             type: string
 *                             description: 제목
 *                           slug:
 *                             type: string
 *                             description: 주소
 *                           description:
 *                             type: string
 *                             description: 설명
 *                             nullable: true
 *                           content:
 *                             type: string
 *                             description: 본문
 *                             nullable: true
 *                           content_json:
 *                             type: string
 *                             description: 직렬화된 블록 JSON 문자열
 *                             nullable: true
 *                           content_html:
 *                             type: string
 *                             description: HTML 본문
 *                             nullable: true
 *                           content_text:
 *                             type: string
 *                             description: 텍스트 본문
 *                             nullable: true
 *                           detailed_description:
 *                             type: string
 *                             description: 상세 설명
 *                             nullable: true
 *                           long_description:
 *                             type: string
 *                             description: 텍스트 본문, 본문, 상세 설명 순의 표시용 값. 생성·수정 응답에는 생략될 수 있습니다.
 *                             nullable: true
 *                           excerpt:
 *                             type: string
 *                             description: 요약
 *                             nullable: true
 *                           meta_description:
 *                             type: string
 *                             description: SEO 설명
 *                             nullable: true
 *                           meta_keywords:
 *                             type: string
 *                             description: SEO 키워드
 *                             nullable: true
 *                           thumbnail_image:
 *                             type: string
 *                             description: 썸네일
 *                             nullable: true
 *                           featured_image:
 *                             type: string
 *                             description: 대표 이미지
 *                             nullable: true
 *                           demo_url:
 *                             type: string
 *                             description: 데모 URL
 *                             nullable: true
 *                           github_url:
 *                             type: string
 *                             description: GitHub URL
 *                             nullable: true
 *                           start_date:
 *                             type: string
 *                             description: 시작일
 *                             nullable: true
 *                           end_date:
 *                             type: string
 *                             description: 종료일
 *                             nullable: true
 *                           status:
 *                             type: string
 *                             description: 상태
 *                             nullable: true
 *                           is_ongoing:
 *                             description: DB에서 반환한 0/1 상태값
 *                             type: integer
 *                             enum:
 *                               - 0
 *                               - 1
 *                               - null
 *                             nullable: true
 *                           is_featured:
 *                             description: DB에서 반환한 0/1 상태값
 *                             type: integer
 *                             enum:
 *                               - 0
 *                               - 1
 *                               - null
 *                             nullable: true
 *                           is_published:
 *                             description: DB에서 반환한 0/1 상태값
 *                             type: integer
 *                             enum:
 *                               - 0
 *                               - 1
 *                               - null
 *                             nullable: true
 *                           featured:
 *                             type: boolean
 *                             description: 추천 여부
 *                           display_order:
 *                             type: integer
 *                             description: 표시 순서
 *                             nullable: true
 *                           view_count:
 *                             type: integer
 *                             description: 조회 수
 *                             nullable: true
 *                           tags:
 *                             type: array
 *                             items:
 *                               type: string
 *                             description: 태그 이름 목록
 *                           skills:
 *                             type: array
 *                             items:
 *                               type: string
 *                             description: 스킬 이름 목록
 *                           images:
 *                             type: array
 *                             items:
 *                               type: string
 *                             description: 이미지 URL 목록
 *                         additionalProperties: true
 *                     pagination:
 *                       $ref: '#/components/schemas/PaginationMeta'
 *                   required:
 *                     - success
 *                     - data
 *                     - pagination
 *       '400':
 *         description: featured가 boolean 값이 아님
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       '401':
 *         description: 인증 토큰이 없거나 유효하지 않음
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       '403':
 *         description: 해당 작업 권한이 없음
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       '500':
 *         description: 서버 또는 권한 확인 오류
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *   post:
 *     summary: 프로젝트 생성
 *     tags:
 *       - Admin - Projects
 *     security:
 *       - bearerAuth: []
 *     description: >-
 *       projects.create 권한이 필요합니다. title과 description/excerpt/meta_description/content_text/content 중 적어도 하나의 비어 있지
 *       않은 문자열이 필요합니다.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               title:
 *                 type: string
 *                 description: 제목
 *                 minLength: 1
 *                 pattern: \S
 *                 maxLength: 255
 *                 example: 포트폴리오 API
 *               slug:
 *                 type: string
 *                 description: 생략하면 제목에서 고유한 주소를 생성합니다.
 *                 nullable: true
 *                 maxLength: 255
 *               description:
 *                 type: string
 *                 description: 설명. 비어 있으면 excerpt, meta_description, content_text, content 순으로 대체하며 대체값은 500자로 자릅니다.
 *                 nullable: true
 *               detailed_description:
 *                 type: string
 *                 description: 상세 설명
 *                 nullable: true
 *               content:
 *                 type: string
 *                 description: 본문
 *                 nullable: true
 *               content_json:
 *                 description: 블록 편집기 데이터입니다. 객체·배열·JSON 문자열을 저장할 수 있으며 null 또는 빈 문자열은 SQL NULL로 저장합니다.
 *                 example:
 *                   blocks: []
 *               content_html:
 *                 type: string
 *                 description: HTML 본문
 *                 nullable: true
 *               content_text:
 *                 type: string
 *                 description: 텍스트 본문
 *                 nullable: true
 *               excerpt:
 *                 type: string
 *                 description: 요약
 *                 nullable: true
 *               meta_description:
 *                 type: string
 *                 description: SEO 설명
 *                 nullable: true
 *               thumbnail_image:
 *                 type: string
 *                 description: 썸네일 URL
 *                 nullable: true
 *                 maxLength: 500
 *               featured_image:
 *                 type: string
 *                 description: 대표 이미지 URL
 *                 nullable: true
 *                 maxLength: 500
 *               demo_url:
 *                 type: string
 *                 description: 데모 URL. 수정 시 이 필드가 있으면 project_url보다 우선하며 빈 문자열은 null로 저장합니다.
 *                 nullable: true
 *                 maxLength: 500
 *               project_url:
 *                 type: string
 *                 description: demo_url의 별칭. 생성 시 demo_url이 비어 있으면 사용합니다.
 *                 nullable: true
 *                 maxLength: 500
 *               github_url:
 *                 type: string
 *                 description: GitHub URL
 *                 nullable: true
 *                 maxLength: 500
 *               start_date:
 *                 type: string
 *                 description: 시작일
 *                 nullable: true
 *                 format: date
 *               end_date:
 *                 type: string
 *                 description: 종료일
 *                 nullable: true
 *                 format: date
 *               is_ongoing:
 *                 type: boolean
 *                 description: 진행 중 여부 null은 false로 저장합니다.
 *                 default: false
 *                 nullable: true
 *               status:
 *                 type: string
 *                 description: 프로젝트 상태. 고정 enum 제한은 없습니다. null 또는 빈 문자열은 completed로 저장합니다.
 *                 default: completed
 *                 maxLength: 50
 *                 nullable: true
 *               is_featured:
 *                 type: boolean
 *                 description: 추천 여부 null은 false로 저장합니다.
 *                 default: false
 *                 nullable: true
 *               is_published:
 *                 type: boolean
 *                 description: 발행 여부 null은 false로 저장합니다.
 *                 default: false
 *                 nullable: true
 *               display_order:
 *                 type: integer
 *                 description: 표시 순서 null은 0으로 저장합니다.
 *                 default: 0
 *                 nullable: true
 *               meta_keywords:
 *                 type: string
 *                 description: SEO 키워드
 *                 nullable: true
 *               tags:
 *                 description: 태그 이름 배열 또는 쉼표로 구분한 문자열입니다. 수정 시 빈 배열로 연결을 모두 해제합니다.
 *                 oneOf:
 *                   - type: array
 *                     items:
 *                       type: string
 *                   - type: string
 *                 example:
 *                   - TypeScript
 *                   - Node.js
 *             required:
 *               - title
 *             anyOf:
 *               - required:
 *                   - description
 *                 properties:
 *                   description:
 *                     type: string
 *                     description: 공백을 제외한 문자열이 필요합니다.
 *                     minLength: 1
 *                     pattern: \S
 *               - required:
 *                   - excerpt
 *                 properties:
 *                   excerpt:
 *                     type: string
 *                     description: 공백을 제외한 문자열이 필요합니다.
 *                     minLength: 1
 *                     pattern: \S
 *               - required:
 *                   - meta_description
 *                 properties:
 *                   meta_description:
 *                     type: string
 *                     description: 공백을 제외한 문자열이 필요합니다.
 *                     minLength: 1
 *                     pattern: \S
 *               - required:
 *                   - content_text
 *                 properties:
 *                   content_text:
 *                     type: string
 *                     description: 공백을 제외한 문자열이 필요합니다.
 *                     minLength: 1
 *                     pattern: \S
 *               - required:
 *                   - content
 *                 properties:
 *                   content:
 *                     type: string
 *                     description: 공백을 제외한 문자열이 필요합니다.
 *                     minLength: 1
 *                     pattern: \S
 *     responses:
 *       '201':
 *         description: 생성된 프로젝트
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/Success'
 *                 - type: object
 *                   properties:
 *                     data:
 *                       type: object
 *                       properties:
 *                         id:
 *                           type: integer
 *                           description: 프로젝트 ID
 *                         title:
 *                           type: string
 *                           description: 제목
 *                         slug:
 *                           type: string
 *                           description: 주소
 *                         description:
 *                           type: string
 *                           description: 설명
 *                           nullable: true
 *                         content:
 *                           type: string
 *                           description: 본문
 *                           nullable: true
 *                         content_json:
 *                           type: string
 *                           description: 직렬화된 블록 JSON 문자열
 *                           nullable: true
 *                         content_html:
 *                           type: string
 *                           description: HTML 본문
 *                           nullable: true
 *                         content_text:
 *                           type: string
 *                           description: 텍스트 본문
 *                           nullable: true
 *                         detailed_description:
 *                           type: string
 *                           description: 상세 설명
 *                           nullable: true
 *                         long_description:
 *                           type: string
 *                           description: 텍스트 본문, 본문, 상세 설명 순의 표시용 값. 생성·수정 응답에는 생략될 수 있습니다.
 *                           nullable: true
 *                         excerpt:
 *                           type: string
 *                           description: 요약
 *                           nullable: true
 *                         meta_description:
 *                           type: string
 *                           description: SEO 설명
 *                           nullable: true
 *                         meta_keywords:
 *                           type: string
 *                           description: SEO 키워드
 *                           nullable: true
 *                         thumbnail_image:
 *                           type: string
 *                           description: 썸네일
 *                           nullable: true
 *                         featured_image:
 *                           type: string
 *                           description: 대표 이미지
 *                           nullable: true
 *                         demo_url:
 *                           type: string
 *                           description: 데모 URL
 *                           nullable: true
 *                         github_url:
 *                           type: string
 *                           description: GitHub URL
 *                           nullable: true
 *                         start_date:
 *                           type: string
 *                           description: 시작일
 *                           nullable: true
 *                         end_date:
 *                           type: string
 *                           description: 종료일
 *                           nullable: true
 *                         status:
 *                           type: string
 *                           description: 상태
 *                           nullable: true
 *                         is_ongoing:
 *                           description: DB에서 반환한 0/1 상태값
 *                           type: integer
 *                           enum:
 *                             - 0
 *                             - 1
 *                             - null
 *                           nullable: true
 *                         is_featured:
 *                           description: DB에서 반환한 0/1 상태값
 *                           type: integer
 *                           enum:
 *                             - 0
 *                             - 1
 *                             - null
 *                           nullable: true
 *                         is_published:
 *                           description: DB에서 반환한 0/1 상태값
 *                           type: integer
 *                           enum:
 *                             - 0
 *                             - 1
 *                             - null
 *                           nullable: true
 *                         featured:
 *                           type: boolean
 *                           description: 추천 여부
 *                         display_order:
 *                           type: integer
 *                           description: 표시 순서
 *                           nullable: true
 *                         view_count:
 *                           type: integer
 *                           description: 조회 수
 *                           nullable: true
 *                         tags:
 *                           type: array
 *                           items:
 *                             type: object
 *                             properties:
 *                               id:
 *                                 type: integer
 *                                 description: 태그 ID
 *                               name:
 *                                 type: string
 *                                 description: 태그 이름
 *                               slug:
 *                                 type: string
 *                                 description: 태그 주소
 *                               description:
 *                                 type: string
 *                                 description: 태그 설명
 *                                 nullable: true
 *                               color:
 *                                 type: string
 *                                 description: 색상
 *                                 nullable: true
 *                               type:
 *                                 type: string
 *                                 description: 태그 유형
 *                                 nullable: true
 *                               usage_count:
 *                                 type: integer
 *                                 description: 사용 횟수
 *                                 nullable: true
 *                               created_at:
 *                                 type: string
 *                                 description: DB 날짜와 시간 문자열(YYYY-MM-DD HH:mm:ss)
 *                                 nullable: true
 *                               updated_at:
 *                                 type: string
 *                                 description: DB 날짜와 시간 문자열(YYYY-MM-DD HH:mm:ss)
 *                                 nullable: true
 *                           description: 태그 객체 목록
 *                         skills:
 *                           type: array
 *                           items:
 *                             type: object
 *                             description: 연결된 스킬 레코드
 *                             additionalProperties: true
 *                           description: 스킬 객체 목록
 *                         images:
 *                           type: array
 *                           items:
 *                             type: object
 *                             description: project_images 레코드
 *                             additionalProperties: true
 *                           description: 이미지 객체 목록
 *                       additionalProperties: true
 *                     message:
 *                       type: string
 *                       description: 처리 결과 메시지
 *                   required:
 *                     - success
 *                     - data
 *                     - message
 *       '400':
 *         description: 제목 또는 설명 후보 누락
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       '401':
 *         description: 인증 토큰이 없거나 유효하지 않음
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       '403':
 *         description: 해당 작업 권한이 없음
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       '500':
 *         description: 서버 또는 권한 확인 오류
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.get('/projects', authenticateToken, requirePermission('projects.read'), async (req: Request, res: Response) => {
    try {
        const pagination = parsePagination(req.query, {
            defaultLimit: 20,
            maxLimit: 100
        });
        const featured = toOptionalBoolean(req.query.featured);
        if (!featured.isValid) {
            return res.status(400).json({
                success: false,
                message: 'featured 값은 boolean이어야 합니다.'
            });
        }

        let projects;
        let total;
        if (featured.value === true) {
            [projects, total] = await Promise.all([
                Projects.getFeatured(pagination.limit, pagination.offset),
                Projects.getCountWithFilters({
                    featured: true,
                    status: 'published',
                    published_only: true
                })
            ]);
        } else {
            [projects, total] = await Promise.all([
                Projects.getAll(pagination.limit, pagination.offset),
                Projects.getCountWithFilters({
                    status: 'all',
                    published_only: false
                })
            ]);
        }

        res.json({
            success: true,
            data: projects,
            pagination: {
                page: pagination.page,
                limit: pagination.limit,
                total,
                totalPages: Math.ceil(total / pagination.limit)
            }
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: '프로젝트를 가져오는데 실패했습니다.'
        });
    }
});

const { getTagNamesError } = require('../../../utils/tag-names');

router.post('/projects',
    authenticateToken,
    requirePermission('projects.create'),
    logActivity('create_project'),
    async (req: Request, res: Response) => {
        try {
            const body = trimStringFields(getPlainBody(req), ['title', 'description']);
            const tagError = getTagNamesError(body.tags);
            if (tagError) return res.status(400).json({ success: false, message: tagError });

            const hasProjectDescription = [
                body.description,
                body.excerpt,
                body.meta_description,
                body.content_text,
                body.content
            ].some((value) => typeof value === 'string' && value.trim());

            if (!hasRequiredStringFields(body, ['title']) || !hasProjectDescription) {
                return res.status(400).json({
                    success: false,
                    message: '제목과 설명은 필수입니다.'
                });
            }

            const sanitizedData = normalizeProjectContentFields(body);

            verboseDebug('원본 데이터:', body);
            verboseDebug('정규화된 데이터:', sanitizedData);
            verboseDebug('undefined 값이 있는지 확인:', Object.values(sanitizedData).some(v => v === undefined));

            const id = await Projects.create(sanitizedData);
            const newProject = await Projects.getById(id);
            CacheUtils.invalidateResources('projects', 'tags');

            res.status(201).json({
                success: true,
                message: '프로젝트가 생성되었습니다.',
                data: newProject
            });
        } catch (error) {
            logger.error('프로젝트 생성 실패', buildErrorLog(error, req));
            res.status(500).json({
                success: false,
                message: '프로젝트 생성에 실패했습니다.'
            });
        }
    }
);

module.exports = router;
