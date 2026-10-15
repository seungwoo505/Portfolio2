import type { Request, Response, Router } from 'express';

const express = require('express');
const {
    BlogPosts,
    authenticateToken,
    buildErrorLog,
    logActivity,
    logger,
    requirePermission
} = require('./common');
const {
    findBlogPostBySlug,
    parseBlogPostSlugParam
} = require('./lookup');
const { normalizeBlogUpdatePayload } = require('./payload');

const router: Router = express.Router();

type BlogRouteError = {
    statusCode: number;
    message: string;
};

const sendRouteError = (res: Response, error: BlogRouteError) => (
    res.status(error.statusCode).json({
        success: false,
        message: error.message
    })
);

/**
 * @swagger
 * /admin/blog/posts/slug/{slug}:
 *   get:
 *     summary: 블로그 포스트 상세 조회 (관리자)
 *     tags:
 *       - Admin - Blog
 *     security:
 *       - bearerAuth: []
 *     description: blog.read 권한이 필요합니다.
 *     parameters:
 *       - name: slug
 *         in: path
 *         required: true
 *         description: 현재 포스트 주소
 *         schema:
 *           type: string
 *           minLength: 1
 *     responses:
 *       '200':
 *         description: 발행 여부와 무관한 포스트 상세
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
 *                   required:
 *                     - success
 *                     - data
 *       '400':
 *         description: 유효하지 않은 slug
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
 *       '404':
 *         description: 포스트 없음
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
 *   put:
 *     summary: 블로그 포스트 수정
 *     tags:
 *       - Admin - Blog
 *     security:
 *       - bearerAuth: []
 *     description: blog.update 권한이 필요합니다. 부분 수정을 지원하며 title만 변경하고 slug를 생략하면 기존 주소를 보존합니다.
 *     parameters:
 *       - name: slug
 *         in: path
 *         required: true
 *         description: 수정 전 포스트 주소
 *         schema:
 *           type: string
 *           minLength: 1
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
 *                 description: 생략하면 제목이 바뀌어도 기존 주소를 유지합니다. 제공하면 고유한 주소로 정규화합니다.
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
 *                 description: 발행 여부
 *                 nullable: true
 *               is_featured:
 *                 type: boolean
 *                 description: 추천 여부
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
 *             minProperties: 1
 *             description: >-
 *               제공한 필드만 수정합니다. title을 제공하면 빈 문자열 또는 null일 수 없습니다. content를 제공하면 content 또는 content_text 중 하나가 비어 있지
 *               않아야 합니다.
 *     responses:
 *       '200':
 *         description: 수정된 포스트
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
 *         description: 유효하지 않은 slug, 빈 수정 본문 또는 잘못된 제목·본문
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
 *       '404':
 *         description: 포스트 없음
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
 *   delete:
 *     summary: 블로그 포스트 삭제
 *     tags:
 *       - Admin - Blog
 *     security:
 *       - bearerAuth: []
 *     description: blog.delete 권한이 필요합니다.
 *     parameters:
 *       - name: slug
 *         in: path
 *         required: true
 *         description: 삭제할 포스트 주소
 *         schema:
 *           type: string
 *           minLength: 1
 *     responses:
 *       '200':
 *         description: 포스트 삭제 완료
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   description: 처리 성공 여부
 *                   example: true
 *                 message:
 *                   type: string
 *                   description: 처리 결과 메시지
 *               required:
 *                 - success
 *                 - message
 *       '400':
 *         description: 유효하지 않은 slug
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
 *       '404':
 *         description: 포스트 없음
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
router.get('/blog/posts/slug/:slug', authenticateToken, requirePermission('blog.read'), async (req: Request, res: Response) => {
    try {
        const parsed = parseBlogPostSlugParam(req.params.slug);
        if (parsed.error) {
            return sendRouteError(res, parsed.error);
        }

        const lookup = await findBlogPostBySlug(parsed.postSlug);
        if (lookup.error) {
            return sendRouteError(res, lookup.error);
        }

        res.json({
            success: true,
            data: lookup.post
        });
    } catch (error) {
        logger.error('블로그 포스트 조회 실패', buildErrorLog(error, req));
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
    async (req: Request, res: Response) => {
        try {
            const parsed = parseBlogPostSlugParam(req.params.slug);
            if (parsed.error) {
                return sendRouteError(res, parsed.error);
            }

            const payload = normalizeBlogUpdatePayload(req);
            if (payload.error) {
                return res.status(400).json({
                    success: false,
                    message: payload.error
                });
            }

            const lookup = await findBlogPostBySlug(parsed.postSlug);
            if (lookup.error) {
                return sendRouteError(res, lookup.error);
            }

            const updatedPost = await BlogPosts.update(lookup.post.id, payload.body);

            res.json({
                success: true,
                message: '블로그 포스트가 수정되었습니다.',
                data: updatedPost
            });
        } catch (error) {
            logger.error('블로그 포스트 수정 실패', buildErrorLog(error, req));
            res.status(500).json({
                success: false,
                message: '블로그 포스트 수정에 실패했습니다.'
            });
        }
    }
);

router.delete('/blog/posts/slug/:slug',
    authenticateToken,
    requirePermission('blog.delete'),
    logActivity('delete_blog_post'),
    async (req: Request, res: Response) => {
        try {
            const parsed = parseBlogPostSlugParam(req.params.slug);
            if (parsed.error) {
                return sendRouteError(res, parsed.error);
            }

            const lookup = await findBlogPostBySlug(parsed.postSlug);
            if (lookup.error) {
                return sendRouteError(res, lookup.error);
            }

            await BlogPosts.delete(lookup.post.id);

            res.json({
                success: true,
                message: '블로그 포스트가 삭제되었습니다.'
            });
        } catch (error) {
            logger.error('블로그 포스트 삭제 실패', buildErrorLog(error, req));
            res.status(500).json({
                success: false,
                message: '블로그 포스트 삭제에 실패했습니다.'
            });
        }
    }
);

module.exports = router;
