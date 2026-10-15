import type { Request, Response, Router } from 'express';

const express = require('express');
const BlogPosts = require('../../models/blog-posts');
const { isValidSlug } = require('../../utils/slug');
const {
    CacheUtils,
    badRequest,
    buildPaginationMeta,
    buildPostFilters,
    fail,
    incrementViewOnce,
    loadCachedPaginatedResource,
    loadCachedSlugResource,
    notFound,
    ok
} = require('./common');

const router: Router = express.Router();

/**
 * @swagger
 * /public/posts:
 *   get:
 *     summary: 공개 블로그 글 목록 조회
 *     tags:
 *       - Blog
 *     security: []
 *     description: 게시된 글만 반환합니다. data의 tags는 태그 이름 배열이며 pagination은 최상위 필드입니다.
 *     parameters:
 *       - in: query
 *         name: page
 *         required: false
 *         description: 페이지 번호. 범위를 벗어난 정수는 1~10000으로 보정하고, 정수가 아니면 1을 사용합니다.
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 10000
 *           default: 1
 *       - in: query
 *         name: limit
 *         required: false
 *         description: 페이지당 개수. 범위를 벗어난 정수는 1~50으로 보정하고, 정수가 아니면 10을 사용합니다.
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 50
 *           default: 10
 *       - in: query
 *         name: search
 *         required: false
 *         description: 제목, 요약, 본문, 메타 키워드 검색
 *         schema:
 *           type: string
 *       - in: query
 *         name: tags
 *         required: false
 *         description: 태그 슬러그 중 하나라도 일치하는 항목 쉼표로 구분하거나 같은 키를 반복할 수 있습니다.
 *         schema:
 *           type: array
 *           items:
 *             type: string
 *         style: form
 *         explode: false
 *       - in: query
 *         name: featured
 *         required: false
 *         description: 추천 여부 필터. true/1/yes/on 또는 false/0/no/off를 허용합니다. 생략하면 필터링하지 않습니다.
 *         schema:
 *           type: boolean
 *       - in: query
 *         name: sort
 *         required: false
 *         description: 추천 항목이 먼저 나오며 지정한 열로 정렬합니다. 유효하지 않으면 published_at을 사용합니다.
 *         schema:
 *           type: string
 *           enum:
 *             - published_at
 *             - created_at
 *             - title
 *             - view_count
 *             - reading_time
 *           default: published_at
 *       - in: query
 *         name: order
 *         required: false
 *         description: 정렬 방향. 유효하지 않으면 desc를 사용합니다.
 *         schema:
 *           type: string
 *           enum:
 *             - asc
 *             - desc
 *           default: desc
 *     responses:
 *       '200':
 *         description: 조회 성공
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
 *                           uuid:
 *                             type: string
 *                             nullable: true
 *                           title:
 *                             type: string
 *                           slug:
 *                             type: string
 *                           excerpt:
 *                             type: string
 *                             nullable: true
 *                           content:
 *                             type: string
 *                           content_json:
 *                             type: string
 *                             nullable: true
 *                             description: JSON을 직렬화한 본문 문자열
 *                           content_html:
 *                             type: string
 *                             nullable: true
 *                           content_text:
 *                             type: string
 *                             nullable: true
 *                           featured_image:
 *                             type: string
 *                             nullable: true
 *                           featured:
 *                             type: boolean
 *                           is_featured:
 *                             type: integer
 *                             enum:
 *                               - 0
 *                               - 1
 *                               - null
 *                             nullable: true
 *                             description: DB의 boolean 값(0 또는 1)
 *                           is_published:
 *                             type: integer
 *                             enum:
 *                               - 0
 *                               - 1
 *                               - null
 *                             nullable: true
 *                             description: DB의 boolean 값(0 또는 1)
 *                           reading_time:
 *                             type: integer
 *                             nullable: true
 *                           view_count:
 *                             type: integer
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
 *                         additionalProperties: true
 *                     pagination:
 *                       $ref: '#/components/schemas/PaginationMeta'
 *                   required:
 *                     - success
 *                     - data
 *       '400':
 *         description: 요청 값 또는 형식이 올바르지 않음
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       '408':
 *         description: 요청 처리 시간 초과
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       '429':
 *         description: 요청 횟수 제한 초과
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       '500':
 *         description: 서버 처리 중 오류 발생
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 * /public/posts/tag/{tagSlug}:
 *   get:
 *     summary: 태그별 공개 블로그 글 목록 조회
 *     tags:
 *       - Blog
 *     security: []
 *     description: 경로의 태그 슬러그에 속한 게시글을 반환합니다. 일치하는 글이 없으면 빈 배열이며, 쿼리의 tags는 경로 값으로 대체됩니다.
 *     parameters:
 *       - in: path
 *         name: tagSlug
 *         required: true
 *         description: 태그 슬러그
 *         schema:
 *           type: string
 *           minLength: 1
 *           maxLength: 255
 *           pattern: ^[a-z0-9가-힣]+(?:-[a-z0-9가-힣]+)*$
 *         example: typescript
 *       - in: query
 *         name: page
 *         required: false
 *         description: 페이지 번호. 범위를 벗어난 정수는 1~10000으로 보정하고, 정수가 아니면 1을 사용합니다.
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 10000
 *           default: 1
 *       - in: query
 *         name: limit
 *         required: false
 *         description: 페이지당 개수. 범위를 벗어난 정수는 1~50으로 보정하고, 정수가 아니면 10을 사용합니다.
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 50
 *           default: 10
 *       - in: query
 *         name: search
 *         required: false
 *         description: 제목, 요약, 본문, 메타 키워드 검색
 *         schema:
 *           type: string
 *       - in: query
 *         name: featured
 *         required: false
 *         description: 추천 여부 필터. true/1/yes/on 또는 false/0/no/off를 허용합니다. 생략하면 필터링하지 않습니다.
 *         schema:
 *           type: boolean
 *       - in: query
 *         name: sort
 *         required: false
 *         description: 추천 항목이 먼저 나오며 지정한 열로 정렬합니다. 유효하지 않으면 published_at을 사용합니다.
 *         schema:
 *           type: string
 *           enum:
 *             - published_at
 *             - created_at
 *             - title
 *             - view_count
 *             - reading_time
 *           default: published_at
 *       - in: query
 *         name: order
 *         required: false
 *         description: 정렬 방향. 유효하지 않으면 desc를 사용합니다.
 *         schema:
 *           type: string
 *           enum:
 *             - asc
 *             - desc
 *           default: desc
 *     responses:
 *       '200':
 *         description: 조회 성공
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
 *                           uuid:
 *                             type: string
 *                             nullable: true
 *                           title:
 *                             type: string
 *                           slug:
 *                             type: string
 *                           excerpt:
 *                             type: string
 *                             nullable: true
 *                           content:
 *                             type: string
 *                           content_json:
 *                             type: string
 *                             nullable: true
 *                             description: JSON을 직렬화한 본문 문자열
 *                           content_html:
 *                             type: string
 *                             nullable: true
 *                           content_text:
 *                             type: string
 *                             nullable: true
 *                           featured_image:
 *                             type: string
 *                             nullable: true
 *                           featured:
 *                             type: boolean
 *                           is_featured:
 *                             type: integer
 *                             enum:
 *                               - 0
 *                               - 1
 *                               - null
 *                             nullable: true
 *                             description: DB의 boolean 값(0 또는 1)
 *                           is_published:
 *                             type: integer
 *                             enum:
 *                               - 0
 *                               - 1
 *                               - null
 *                             nullable: true
 *                             description: DB의 boolean 값(0 또는 1)
 *                           reading_time:
 *                             type: integer
 *                             nullable: true
 *                           view_count:
 *                             type: integer
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
 *                         additionalProperties: true
 *                     pagination:
 *                       $ref: '#/components/schemas/PaginationMeta'
 *                   required:
 *                     - success
 *                     - data
 *       '400':
 *         description: 요청 값 또는 형식이 올바르지 않음
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       '408':
 *         description: 요청 처리 시간 초과
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       '429':
 *         description: 요청 횟수 제한 초과
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       '500':
 *         description: 서버 처리 중 오류 발생
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 * /public/posts/{slug}:
 *   get:
 *     summary: 공개 블로그 글 상세 조회
 *     tags:
 *       - Blog
 *     security: []
 *     description: 게시된 글만 반환합니다. 상세의 tags는 태그 레코드 객체 배열입니다.
 *     parameters:
 *       - in: path
 *         name: slug
 *         required: true
 *         description: 공개 리소스 슬러그
 *         schema:
 *           type: string
 *           minLength: 1
 *           maxLength: 255
 *           pattern: ^[a-z0-9가-힣]+(?:-[a-z0-9가-힣]+)*$
 *         example: portfolio-api
 *     responses:
 *       '200':
 *         description: 조회 성공
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
 *                         uuid:
 *                           type: string
 *                           nullable: true
 *                         title:
 *                           type: string
 *                         slug:
 *                           type: string
 *                         excerpt:
 *                           type: string
 *                           nullable: true
 *                         content:
 *                           type: string
 *                         content_json:
 *                           type: string
 *                           nullable: true
 *                           description: JSON을 직렬화한 본문 문자열
 *                         content_html:
 *                           type: string
 *                           nullable: true
 *                         content_text:
 *                           type: string
 *                           nullable: true
 *                         featured_image:
 *                           type: string
 *                           nullable: true
 *                         featured:
 *                           type: boolean
 *                         is_featured:
 *                           type: integer
 *                           enum:
 *                             - 0
 *                             - 1
 *                             - null
 *                           nullable: true
 *                           description: DB의 boolean 값(0 또는 1)
 *                         is_published:
 *                           type: integer
 *                           enum:
 *                             - 0
 *                             - 1
 *                             - null
 *                           nullable: true
 *                           description: DB의 boolean 값(0 또는 1)
 *                         reading_time:
 *                           type: integer
 *                           nullable: true
 *                         view_count:
 *                           type: integer
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
 *                               name:
 *                                 type: string
 *                               slug:
 *                                 type: string
 *                               description:
 *                                 type: string
 *                                 nullable: true
 *                               color:
 *                                 type: string
 *                                 nullable: true
 *                               type:
 *                                 type: string
 *                                 nullable: true
 *                               usage_count:
 *                                 type: integer
 *                             additionalProperties: true
 *                       additionalProperties: true
 *                   required:
 *                     - success
 *                     - data
 *       '400':
 *         description: 요청 값 또는 형식이 올바르지 않음
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       '404':
 *         description: 공개된 리소스를 찾을 수 없음
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       '408':
 *         description: 요청 처리 시간 초과
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       '429':
 *         description: 요청 횟수 제한 초과
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       '500':
 *         description: 서버 처리 중 오류 발생
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 * /public/posts/{slug}/view:
 *   post:
 *     summary: 블로그 글 조회수 증가
 *     tags:
 *       - Blog
 *     security: []
 *     description: >-
 *       본문 없이 호출합니다. IP와 User-Agent 조합별로 일정 시간 내 중복 조회를 억제하며, 중복 요청에도 같은 성공 메시지를 반환합니다. 기본 중복 억제 시간은 300초이며
 *       PUBLIC_VIEW_DEDUPE_TTL_SECONDS로 조정할 수 있습니다.
 *     parameters:
 *       - in: path
 *         name: slug
 *         required: true
 *         description: 공개 리소스 슬러그
 *         schema:
 *           type: string
 *           minLength: 1
 *           maxLength: 255
 *           pattern: ^[a-z0-9가-힣]+(?:-[a-z0-9가-힣]+)*$
 *         example: portfolio-api
 *     responses:
 *       '200':
 *         description: 조회수 처리 성공
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
 *                   example: 조회수가 증가되었습니다.
 *               required:
 *                 - success
 *                 - message
 *       '400':
 *         description: 요청 값 또는 형식이 올바르지 않음
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       '404':
 *         description: 공개된 리소스를 찾을 수 없음
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       '408':
 *         description: 요청 처리 시간 초과
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       '429':
 *         description: 요청 횟수 제한 초과
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       '500':
 *         description: 서버 처리 중 오류 발생
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       '503':
 *         description: 중복 조회 방지를 보장할 수 없어 일시적으로 요청을 처리할 수 없음
 *         headers:
 *           Cache-Control:
 *             schema:
 *               type: string
 *               example: no-store
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.get('/posts', async (req: Request, res: Response) => {
    try {
        const filters = buildPostFilters(req.query);
        if (filters.error) {
            return badRequest(res, filters.error);
        }
        const data = await loadCachedPaginatedResource({
            cachePrefix: 'blog_posts',
            filters,
            loadItems: () => BlogPosts.getWithFilters(filters),
            loadTotal: () => BlogPosts.getCountWithFilters(filters)
        });

        return ok(res, data.items, {
            pagination: buildPaginationMeta(filters, data.total)
        });
    } catch (error) {
        return fail(res, error, req, '블로그 글 목록을 가져오는데 실패했습니다.');
    }
});

router.get('/posts/tag/:tagSlug', async (req: Request, res: Response) => {
    try {
        const { tagSlug } = req.params;
        if (!isValidSlug(tagSlug)) {
            return badRequest(res, '유효한 slug가 필요합니다.');
        }

        const filters = buildPostFilters({
            ...req.query,
            tags: tagSlug
        });
        if (filters.error) {
            return badRequest(res, filters.error);
        }

        const data = await loadCachedPaginatedResource({
            cachePrefix: 'blog_posts',
            cacheParts: ['tag', tagSlug],
            filters,
            loadItems: () => BlogPosts.getWithFilters(filters),
            loadTotal: () => BlogPosts.getCountWithFilters(filters)
        });

        return ok(res, data.items, {
            pagination: buildPaginationMeta(filters, data.total)
        });
    } catch (error) {
        return fail(res, error, req, '태그별 블로그 글 목록을 가져오는데 실패했습니다.');
    }
});

router.post('/posts/:slug/view', async (req: Request, res: Response) => {
    try {
        const { slug } = req.params;
        if (!isValidSlug(slug)) {
            return badRequest(res, '유효한 slug가 필요합니다.');
        }

        const post = await BlogPosts.getBySlug(slug);
        if (!post) {
            return notFound(res, '블로그 글을 찾을 수 없습니다.');
        }

        await incrementViewOnce({
            resourceType: 'post',
            slug,
            req,
            increment: () => BlogPosts.incrementView(post.id),
            invalidate: () => {
                CacheUtils.invalidateResources('blog');
            }
        });

        res.setHeader('Cache-Control', 'no-store');
        return res.json({
            success: true,
            message: '조회수가 증가되었습니다.'
        });
    } catch (error) {
        return fail(res, error, req, '블로그 조회수 증가에 실패했습니다.');
    }
});

router.get('/posts/:slug', async (req: Request, res: Response) => {
    try {
        const { slug } = req.params;
        if (!isValidSlug(slug)) {
            return badRequest(res, '유효한 slug가 필요합니다.');
        }

        const data = await loadCachedSlugResource({
            cachePrefix: 'blog_post',
            slug,
            loadResource: () => BlogPosts.getBySlug(slug)
        });

        if (!data) {
            return notFound(res, '블로그 글을 찾을 수 없습니다.');
        }

        return ok(res, data);
    } catch (error) {
        return fail(res, error, req, '블로그 글 정보를 가져오는데 실패했습니다.');
    }
});

module.exports = router;
