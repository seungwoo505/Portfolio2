import type { Request, Response, Router } from 'express';

const express = require('express');
const {
    BlogPosts,
    CacheUtils,
    authenticateToken,
    buildErrorLog,
    getPlainBody,
    hasRequiredStringFields,
    logActivity,
    logger,
    parsePagination,
    requirePermission,
} = require('./common');
const {
    hasUsableContent,
    normalizeBlogContentFields
} = require('./payload');

const router: Router = express.Router();

/**
 * @swagger
 * /admin/blog/posts:
 *   get:
 *     summary: 관리자 블로그 포스트 목록 조회
 *     tags:
 *       - Admin - Blog
 *     security:
 *       - bearerAuth: []
 *     description: blog.read 권한이 필요합니다. 발행·미발행 포스트를 모두 조회합니다.
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
 *     responses:
 *       '200':
 *         description: 발행 여부와 무관한 포스트 목록
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
 *                             description: 포스트 ID
 *                           uuid:
 *                             type: string
 *                             description: UUID
 *                             nullable: true
 *                           title:
 *                             type: string
 *                             description: 제목
 *                           slug:
 *                             type: string
 *                             description: 주소
 *                           excerpt:
 *                             type: string
 *                             description: 요약
 *                             nullable: true
 *                           content:
 *                             type: string
 *                             description: 본문
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
 *                           featured_image:
 *                             type: string
 *                             description: 대표 이미지
 *                             nullable: true
 *                           is_published:
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
 *                           featured:
 *                             type: boolean
 *                             description: 추천 여부
 *                           reading_time:
 *                             type: integer
 *                             description: 예상 읽기 시간(분)
 *                             nullable: true
 *                           view_count:
 *                             type: integer
 *                             description: 조회 수
 *                             nullable: true
 *                           meta_title:
 *                             type: string
 *                             description: SEO 제목
 *                             nullable: true
 *                           meta_description:
 *                             type: string
 *                             description: SEO 설명
 *                             nullable: true
 *                           meta_keywords:
 *                             type: string
 *                             description: SEO 키워드
 *                             nullable: true
 *                           published_at:
 *                             type: string
 *                             description: DB 날짜와 시간 문자열(YYYY-MM-DD HH:mm:ss)
 *                             nullable: true
 *                           created_at:
 *                             type: string
 *                             description: DB 날짜와 시간 문자열(YYYY-MM-DD HH:mm:ss)
 *                             nullable: true
 *                           updated_at:
 *                             type: string
 *                             description: DB 날짜와 시간 문자열(YYYY-MM-DD HH:mm:ss)
 *                             nullable: true
 *                           tags:
 *                             type: array
 *                             items:
 *                               type: string
 *                             description: 태그 이름 목록
 *                     pagination:
 *                       $ref: '#/components/schemas/PaginationMeta'
 *                   required:
 *                     - success
 *                     - data
 *                     - pagination
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
 *     summary: 블로그 포스트 생성
 *     tags:
 *       - Admin - Blog
 *     security:
 *       - bearerAuth: []
 *     description: >-
 *       blog.create 권한이 필요합니다. title과 content 또는 content_text의 비어 있지 않은 문자열이 필요합니다. content_json/content_html만으로는 본문
 *       필수 조건을 충족하지 않습니다.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               title:
 *                 type: string
 *                 description: 공백만 있는 제목은 허용하지 않습니다.
 *                 minLength: 1
 *                 pattern: \S
 *                 maxLength: 255
 *                 example: 새 블로그 글
 *               slug:
 *                 type: string
 *                 description: 생략하면 제목에서 고유한 주소를 생성합니다.
 *                 nullable: true
 *                 maxLength: 255
 *               excerpt:
 *                 type: string
 *                 description: 요약
 *                 nullable: true
 *               content:
 *                 type: string
 *                 description: 본문. 비어 있으면 비어 있지 않은 content_text를 본문으로 사용합니다.
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
 *                 description: 텍스트 본문. content의 대체 입력으로도 사용합니다.
 *                 nullable: true
 *               featured_image:
 *                 type: string
 *                 description: 대표 이미지 URL
 *                 nullable: true
 *                 maxLength: 500
 *               is_published:
 *                 type: boolean
 *                 description: 발행 여부 null은 false로 저장합니다.
 *                 default: false
 *                 nullable: true
 *               is_featured:
 *                 type: boolean
 *                 description: 추천 여부 null은 false로 저장합니다.
 *                 default: false
 *                 nullable: true
 *               meta_title:
 *                 type: string
 *                 description: SEO 제목
 *                 nullable: true
 *                 maxLength: 255
 *               meta_description:
 *                 type: string
 *                 description: SEO 설명
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
 *                   - content
 *                 properties:
 *                   content:
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
 *     responses:
 *       '201':
 *         description: 생성된 포스트와 태그 객체
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
 *                           description: 포스트 ID
 *                         uuid:
 *                           type: string
 *                           description: UUID
 *                           nullable: true
 *                         title:
 *                           type: string
 *                           description: 제목
 *                         slug:
 *                           type: string
 *                           description: 주소
 *                         excerpt:
 *                           type: string
 *                           description: 요약
 *                           nullable: true
 *                         content:
 *                           type: string
 *                           description: 본문
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
 *                         featured_image:
 *                           type: string
 *                           description: 대표 이미지
 *                           nullable: true
 *                         is_published:
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
 *                         featured:
 *                           type: boolean
 *                           description: 추천 여부
 *                         reading_time:
 *                           type: integer
 *                           description: 예상 읽기 시간(분)
 *                           nullable: true
 *                         view_count:
 *                           type: integer
 *                           description: 조회 수
 *                           nullable: true
 *                         meta_title:
 *                           type: string
 *                           description: SEO 제목
 *                           nullable: true
 *                         meta_description:
 *                           type: string
 *                           description: SEO 설명
 *                           nullable: true
 *                         meta_keywords:
 *                           type: string
 *                           description: SEO 키워드
 *                           nullable: true
 *                         published_at:
 *                           type: string
 *                           description: DB 날짜와 시간 문자열(YYYY-MM-DD HH:mm:ss)
 *                           nullable: true
 *                         created_at:
 *                           type: string
 *                           description: DB 날짜와 시간 문자열(YYYY-MM-DD HH:mm:ss)
 *                           nullable: true
 *                         updated_at:
 *                           type: string
 *                           description: DB 날짜와 시간 문자열(YYYY-MM-DD HH:mm:ss)
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
 *                     message:
 *                       type: string
 *                       description: 처리 결과 메시지
 *                   required:
 *                     - success
 *                     - data
 *                     - message
 *       '400':
 *         description: 제목 또는 본문 누락
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
router.get('/blog/posts', authenticateToken, requirePermission('blog.read'), async (req: Request, res: Response) => {
    try {
        const { limit, page, offset } = parsePagination(req.query, {
            defaultLimit: 20,
            maxLimit: 100
        });

        const [posts, total] = await Promise.all([
            BlogPosts.getAll(limit, offset, false),
            BlogPosts.getCountWithFilters({
                status: 'all',
                published_only: false
            })
        ]);

        res.json({
            success: true,
            data: posts,
            pagination: {
                page,
                limit,
                total,
                totalPages: Math.ceil(total / limit)
            }
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: '블로그 포스트를 가져오는데 실패했습니다.'
        });
    }
});

const { getTagNamesError } = require('../../../utils/tag-names');

router.post('/blog/posts',
    authenticateToken,
    requirePermission('blog.create'),
    logActivity('create_blog_post'),
    async (req: Request, res: Response) => {
        try {
            const body = normalizeBlogContentFields(getPlainBody(req));
            const tagError = getTagNamesError(body.tags);
            if (tagError) return res.status(400).json({ success: false, message: tagError });

            if (!hasRequiredStringFields(body, ['title']) || !hasUsableContent(body)) {
                return res.status(400).json({
                    success: false,
                    message: '제목과 내용은 필수입니다.'
                });
            }

            const id = await BlogPosts.create(body);
            const newPost = await BlogPosts.getById(id);
            CacheUtils.invalidateResources('blog');

            res.status(201).json({
                success: true,
                message: '블로그 포스트가 생성되었습니다.',
                data: newPost
            });
        } catch (error) {
            logger.error('블로그 포스트 생성 실패', buildErrorLog(error, req));
            res.status(500).json({
                success: false,
                message: '블로그 포스트 생성에 실패했습니다.'
            });
        }
    }
);

module.exports = router;
