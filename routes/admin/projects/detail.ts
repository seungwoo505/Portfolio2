import type { Request, Response, Router } from 'express';

const express = require('express');
const {
    CacheUtils,
    Projects,
    authenticateToken,
    buildErrorLog,
    logActivity,
    logger,
    parseSlugParam,
    requirePermission
} = require('./common');
const { parseProjectUpdateRequest, updateProjectBySlug } = require('./update');

const router: Router = express.Router();

/**
 * @swagger
 * /admin/projects/slug/{slug}:
 *   get:
 *     summary: 프로젝트 상세 조회 (관리자)
 *     tags:
 *       - Admin - Projects
 *     security:
 *       - bearerAuth: []
 *     description: projects.read 권한이 필요합니다.
 *     parameters:
 *       - name: slug
 *         in: path
 *         required: true
 *         description: 프로젝트 주소
 *         schema:
 *           type: string
 *           minLength: 1
 *     responses:
 *       '200':
 *         description: 프로젝트 및 연결된 스킬·이미지·태그 객체
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
 *         description: 프로젝트 없음
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
 *     summary: 프로젝트 수정
 *     tags:
 *       - Admin - Projects
 *     security:
 *       - bearerAuth: []
 *     description: projects.update 권한이 필요합니다. 부분 수정을 지원하며 title을 바꾸고 slug를 생략하면 기존 주소를 보존합니다.
 *     parameters:
 *       - name: slug
 *         in: path
 *         required: true
 *         description: 수정 전 프로젝트 주소
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
 *                 description: 제목
 *                 minLength: 1
 *                 pattern: \S
 *                 maxLength: 255
 *                 example: 포트폴리오 API
 *               slug:
 *                 type: string
 *                 description: 생략하면 제목 수정 후에도 기존 주소를 유지합니다. 명시하면 주소를 다시 생성합니다.
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
 *                 description: 진행 중 여부
 *                 nullable: true
 *               status:
 *                 type: string
 *                 description: 프로젝트 상태. 고정 enum 제한은 없습니다.
 *                 nullable: true
 *               is_featured:
 *                 type: boolean
 *                 description: 추천 여부
 *                 nullable: true
 *               is_published:
 *                 type: boolean
 *                 description: 발행 여부
 *                 nullable: true
 *               display_order:
 *                 type: integer
 *                 description: 표시 순서
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
 *               제공한 필드만 수정합니다. title은 제공 시 비어 있을 수 없습니다. description을 비워 보내는 경우 설명 후보 필드 중 하나에 비어 있지 않은 문자열이 필요합니다.
 *               description을 생략하면 설명을 유지합니다.
 *     responses:
 *       '200':
 *         description: 수정된 프로젝트
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
 *         description: 유효하지 않은 slug, 빈 수정 본문 또는 잘못된 제목·설명
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
 *         description: 프로젝트 없음
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
 *     summary: 프로젝트 삭제
 *     tags:
 *       - Admin - Projects
 *     security:
 *       - bearerAuth: []
 *     description: projects.delete 권한이 필요합니다.
 *     parameters:
 *       - name: slug
 *         in: path
 *         required: true
 *         description: 삭제할 프로젝트 주소
 *         schema:
 *           type: string
 *           minLength: 1
 *     responses:
 *       '200':
 *         description: 프로젝트와 연결 데이터 삭제 완료
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
 *         description: 프로젝트 없음
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
router.get('/projects/slug/:slug', authenticateToken, requirePermission('projects.read'), async (req: Request, res: Response) => {
    try {
        const projectSlug = parseSlugParam(req.params.slug);
        if (!projectSlug) {
            return res.status(400).json({
                success: false,
                message: '유효한 slug가 필요합니다.'
            });
        }

        const project = await Projects.getBySlug(projectSlug);

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
        logger.error('프로젝트 조회 실패', buildErrorLog(error, req));
        res.status(500).json({
            success: false,
            message: '프로젝트 정보를 가져오는데 실패했습니다.'
        });
    }
});

router.put('/projects/slug/:slug',
    authenticateToken,
    requirePermission('projects.update'),
    logActivity('update_project'),
    async (req: Request, res: Response) => {
        try {
            const parsed = parseProjectUpdateRequest(req);
            if (parsed.error) {
                return res.status(parsed.error.statusCode).json({
                    success: false,
                    message: parsed.error.message
                });
            }

            const updateResult = await updateProjectBySlug(parsed.projectSlug, parsed.sanitizedData, req);
            if (updateResult.notFound) {
                return res.status(404).json({
                    success: false,
                    message: '프로젝트를 찾을 수 없습니다.'
                });
            }

            res.json({
                success: true,
                message: '프로젝트가 수정되었습니다.',
                data: updateResult.project
            });
        } catch (error) {
            logger.error('프로젝트 수정 실패', buildErrorLog(error, req));
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
    async (req: Request, res: Response) => {
        try {
            const projectSlug = parseSlugParam(req.params.slug);
            if (!projectSlug) {
                return res.status(400).json({
                    success: false,
                    message: '유효한 slug가 필요합니다.'
                });
            }

            const project = await Projects.getBySlug(projectSlug);
            if (!project) {
                return res.status(404).json({
                    success: false,
                    message: '프로젝트를 찾을 수 없습니다.'
                });
            }

            await Projects.delete(project.id);
            CacheUtils.invalidateResources('projects', 'tags');

            res.json({
                success: true,
                message: '프로젝트가 삭제되었습니다.'
            });
        } catch (error) {
            logger.error('프로젝트 삭제 실패', buildErrorLog(error, req));
            res.status(500).json({
                success: false,
                message: '프로젝트 삭제에 실패했습니다.'
            });
        }
    }
);

module.exports = router;
