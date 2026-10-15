import type { Request, Response, Router } from 'express';

const express = require('express');
const {
    authenticateToken,
    buildErrorLog,
    logActivity,
    logger,
    requirePermission
} = require('./common');
const { updateBlogPostStatusBySlug } = require('./status-update');

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
 * /admin/blog/posts/slug/{slug}/publish:
 *   put:
 *     summary: 블로그 포스트 발행 상태 변경
 *     tags:
 *       - Admin - Blog
 *     security:
 *       - bearerAuth: []
 *     description: blog.publish 권한이 필요합니다.
 *     parameters:
 *       - name: slug
 *         in: path
 *         required: true
 *         description: 포스트 주소
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
 *               is_published:
 *                 type: boolean
 *                 description: 발행 여부. true/false를 사용합니다. 문자열 true/false, 1/0, yes/no, on/off 및 숫자 1/0도 정규화합니다.
 *                 example: true
 *             required:
 *               - is_published
 *     responses:
 *       '200':
 *         description: 발행 상태를 변경한 포스트
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
 *         description: 유효하지 않은 slug 또는 boolean 상태값
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
router.put('/blog/posts/slug/:slug/publish',
    authenticateToken,
    requirePermission('blog.publish'),
    logActivity('publish_blog_post'),
    async (req: Request, res: Response) => {
        try {
            const result = await updateBlogPostStatusBySlug({
                body: req.body,
                falseMessage: '포스트 발행이 취소되었습니다.',
                field: 'is_published',
                invalidMessage: '발행 상태는 boolean 값이어야 합니다.',
                slug: req.params.slug,
                trueMessage: '포스트가 발행되었습니다.'
            });
            if (result.error) {
                return sendRouteError(res, result.error);
            }

            res.json({
                success: true,
                message: result.message,
                data: result.data
            });
        } catch (error) {
            res.status(500).json({
                success: false,
                message: '포스트 발행 상태 변경에 실패했습니다.'
            });
        }
    }
);

/**
 * @swagger
 * /admin/blog/posts/slug/{slug}/featured:
 *   put:
 *     summary: 블로그 포스트 추천 상태 변경
 *     tags:
 *       - Admin - Blog
 *     security:
 *       - bearerAuth: []
 *     description: blog.edit 권한이 필요합니다.
 *     parameters:
 *       - name: slug
 *         in: path
 *         required: true
 *         description: 포스트 주소
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
 *               is_featured:
 *                 type: boolean
 *                 description: 추천 여부. true/false를 사용합니다. 문자열 true/false, 1/0, yes/no, on/off 및 숫자 1/0도 정규화합니다.
 *                 example: true
 *             required:
 *               - is_featured
 *     responses:
 *       '200':
 *         description: 추천 상태를 변경한 포스트
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
 *         description: 유효하지 않은 slug 또는 boolean 상태값
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
router.put('/blog/posts/slug/:slug/featured',
    authenticateToken,
    requirePermission('blog.edit'),
    logActivity('feature_blog_post'),
    async (req: Request, res: Response) => {
        try {
            const result = await updateBlogPostStatusBySlug({
                body: req.body,
                falseMessage: '포스트 추천이 해제되었습니다.',
                field: 'is_featured',
                invalidMessage: '추천 상태는 boolean 값이어야 합니다.',
                slug: req.params.slug,
                trueMessage: '포스트가 추천되었습니다.'
            });
            if (result.error) {
                return sendRouteError(res, result.error);
            }

            res.json({
                success: true,
                message: result.message,
                data: result.data
            });
        } catch (error) {
            logger.error('블로그 포스트 추천 상태 변경 실패', buildErrorLog(error, req));
            res.status(500).json({
                success: false,
                message: '포스트 추천 상태 변경에 실패했습니다.'
            });
        }
    }
);

module.exports = router;
