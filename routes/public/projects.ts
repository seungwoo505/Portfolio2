import type { Request, Response, Router } from 'express';

const express = require('express');
const Projects = require('../../models/projects');
const { isValidSlug } = require('../../utils/slug');
const {
    CacheUtils,
    badRequest,
    buildPaginationMeta,
    buildProjectFilters,
    cacheKey,
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
 * /public/projects:
 *   get:
 *     summary: 공개 프로젝트 목록 조회
 *     tags:
 *       - Projects
 *     security: []
 *     description: 게시된 프로젝트만 반환합니다. data의 skills와 tags는 이름 배열, images는 이미지 URL 배열이며 pagination은 최상위 필드입니다.
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
 *         description: 제목, 설명, 본문, 기술 문자열 검색
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
 *         name: skills
 *         required: false
 *         description: >-
 *           기술 이름 중 하나라도 일치하는 프로젝트를 조회합니다. 같은 키를 반복하면 각 항목의 쉼표를 보존합니다
 *           (예 skills=CI%2C%20CD&skills=React). 단일 skills 문자열은 기존 CSV로 해석합니다
 *           (예 skills=React,Node.js). 쉼표 포함 기술명 하나는 skills[]=CI%2C%20CD를 사용합니다.
 *         schema:
 *           type: array
 *           items:
 *             type: string
 *         style: form
 *         explode: true
 *       - in: query
 *         name: skills[]
 *         required: false
 *         description: >-
 *           쉼표 포함 단일 기술명도 보존하는 명시 배열입니다 (예 skills[]=CI%2C%20CD).
 *           여러 기술명은 같은 skills[] 키를 반복합니다. 각 항목의 앞뒤 공백은 제거합니다.
 *           skills와 함께 제공하면 skills[]만 사용합니다.
 *         schema:
 *           type: array
 *           items:
 *             type: string
 *         style: form
 *         explode: true
 *       - in: query
 *         name: featured
 *         required: false
 *         description: 추천 여부 필터. true/1/yes/on 또는 false/0/no/off를 허용합니다. 생략하면 필터링하지 않습니다.
 *         schema:
 *           type: boolean
 *       - in: query
 *         name: sort
 *         required: false
 *         description: >-
 *           추천 항목이 먼저 나옵니다. display_order는 노출 순서 오름차순, 생성일 내림차순이며 다른 정렬은 order를 따릅니다. 유효하지 않으면 created_at을
 *           사용합니다.
 *         schema:
 *           type: string
 *           enum:
 *             - created_at
 *             - title
 *             - view_count
 *             - display_order
 *           default: display_order
 *       - in: query
 *         name: order
 *         required: false
 *         description: display_order 이외 정렬에 적용됩니다. 유효하지 않으면 desc를 사용합니다.
 *         schema:
 *           type: string
 *           enum:
 *             - asc
 *             - desc
 *           default: asc
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
 *                           title:
 *                             type: string
 *                           slug:
 *                             type: string
 *                           description:
 *                             type: string
 *                             nullable: true
 *                           short_description:
 *                             type: string
 *                             nullable: true
 *                           content:
 *                             type: string
 *                             nullable: true
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
 *                           long_description:
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
 *                           view_count:
 *                             type: integer
 *                             nullable: true
 *                           skills:
 *                             type: array
 *                             items:
 *                               type: string
 *                           tags:
 *                             type: array
 *                             items:
 *                               type: string
 *                           images:
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
 * /public/projects/{slug}:
 *   get:
 *     summary: 공개 프로젝트 상세 조회
 *     tags:
 *       - Projects
 *     security: []
 *     description: 게시된 프로젝트만 반환합니다. 상세의 skills, tags, images는 각각 연관 레코드 객체 배열입니다.
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
 *                         title:
 *                           type: string
 *                         slug:
 *                           type: string
 *                         description:
 *                           type: string
 *                           nullable: true
 *                         short_description:
 *                           type: string
 *                           nullable: true
 *                         content:
 *                           type: string
 *                           nullable: true
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
 *                         long_description:
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
 *                         view_count:
 *                           type: integer
 *                           nullable: true
 *                         skills:
 *                           type: array
 *                           items:
 *                             type: object
 *                             properties:
 *                               id:
 *                                 type: integer
 *                               name:
 *                                 type: string
 *                               category_id:
 *                                 type: integer
 *                                 nullable: true
 *                             additionalProperties: true
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
 *                         images:
 *                           type: array
 *                           items:
 *                             type: object
 *                             properties:
 *                               id:
 *                                 type: integer
 *                               project_id:
 *                                 type: integer
 *                               image_url:
 *                                 type: string
 *                               alt_text:
 *                                 type: string
 *                                 nullable: true
 *                               display_order:
 *                                 type: integer
 *                                 nullable: true
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
 * /public/projects/{slug}/view:
 *   post:
 *     summary: 프로젝트 조회수 증가
 *     tags:
 *       - Projects
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
router.get('/projects', async (req: Request, res: Response) => {
    try {
        const filters = buildProjectFilters(req.query);
        if (filters.error) {
            return badRequest(res, filters.error);
        }
        const data = await loadCachedPaginatedResource({
            cachePrefix: 'projects',
            filters,
            loadItems: () => Projects.getWithFilters(filters),
            loadTotal: () => Projects.getCountWithFilters(filters)
        });

        return ok(res, data.items, {
            pagination: buildPaginationMeta(filters, data.total)
        });
    } catch (error) {
        return fail(res, error, req, '프로젝트 목록을 가져오는데 실패했습니다.');
    }
});

router.post('/projects/:slug/view', async (req: Request, res: Response) => {
    try {
        const { slug } = req.params;
        if (!isValidSlug(slug)) {
            return badRequest(res, '유효한 slug가 필요합니다.');
        }

        const project = await Projects.getBySlug(slug);
        if (!project || !project.is_published) {
            return notFound(res, '프로젝트를 찾을 수 없습니다.');
        }

        await incrementViewOnce({
            resourceType: 'project',
            slug,
            req,
            increment: () => Projects.incrementView(project.id),
            invalidate: () => {
                CacheUtils.del(cacheKey('project', 'slug', slug));
                CacheUtils.delPattern('projects:public:');
            }
        });

        res.setHeader('Cache-Control', 'no-store');
        return res.json({
            success: true,
            message: '조회수가 증가되었습니다.'
        });
    } catch (error) {
        return fail(res, error, req, '프로젝트 조회수 증가에 실패했습니다.');
    }
});

router.get('/projects/:slug', async (req: Request, res: Response) => {
    try {
        const { slug } = req.params;
        if (!isValidSlug(slug)) {
            return badRequest(res, '유효한 slug가 필요합니다.');
        }

        const data = await loadCachedSlugResource({
            cachePrefix: 'project',
            slug,
            loadResource: () => Projects.getBySlug(slug)
        });

        if (!data || !data.is_published) {
            return notFound(res, '프로젝트를 찾을 수 없습니다.');
        }

        return ok(res, data);
    } catch (error) {
        return fail(res, error, req, '프로젝트 정보를 가져오는데 실패했습니다.');
    }
});

module.exports = router;
