import type { Request, Response, Router } from 'express';

const express = require('express');
const PersonalInfo = require('../../models/personal-info');
const SocialLinks = require('../../models/social-links');
const SiteSettings = require('../../models/site-settings');
const { cacheKey, cached, fail, ok } = require('./common');

const router: Router = express.Router();

/**
 * @swagger
 * /public/profile:
 *   get:
 *     summary: 공개 프로필 조회
 *     tags:
 *       - Profile
 *     security: []
 *     description: 최신 프로필 한 건을 반환합니다. 등록된 프로필이 없으면 data는 null입니다.
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
 *                         name:
 *                           type: string
 *                           nullable: true
 *                         full_name:
 *                           type: string
 *                           nullable: true
 *                         title:
 *                           type: string
 *                           nullable: true
 *                         bio:
 *                           type: string
 *                           nullable: true
 *                         about:
 *                           type: string
 *                           nullable: true
 *                         email:
 *                           type: string
 *                           nullable: true
 *                         phone:
 *                           type: string
 *                           nullable: true
 *                         location:
 *                           type: string
 *                           nullable: true
 *                         avatar_url:
 *                           type: string
 *                           nullable: true
 *                         profile_image:
 *                           type: string
 *                           nullable: true
 *                         resume_url:
 *                           type: string
 *                           nullable: true
 *                         github_url:
 *                           type: string
 *                           nullable: true
 *                         linkedin_url:
 *                           type: string
 *                           nullable: true
 *                         twitter_url:
 *                           type: string
 *                           nullable: true
 *                         instagram_url:
 *                           type: string
 *                           nullable: true
 *                       additionalProperties: true
 *                       nullable: true
 *                   required:
 *                     - success
 *                     - data
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
 * /public/settings:
 *   get:
 *     summary: 공개 사이트 설정 조회
 *     tags:
 *       - Settings
 *     security: []
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
 *                       additionalProperties: {}
 *                       description: 공개 설정 키와 파싱된 값의 맵. 값은 문자열, 숫자, boolean, JSON 또는 null입니다.
 *                   required:
 *                     - success
 *                     - data
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
 * /public/social-links:
 *   get:
 *     summary: 공개 소셜 링크 조회
 *     tags:
 *       - Social
 *     security: []
 *     description: 활성화된 소셜 링크를 노출 순서와 ID 오름차순으로 반환합니다.
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
 *                           platform:
 *                             type: string
 *                           url:
 *                             type: string
 *                           icon:
 *                             type: string
 *                             nullable: true
 *                           display_order:
 *                             type: integer
 *                             nullable: true
 *                           is_active:
 *                             type: integer
 *                             enum:
 *                               - 0
 *                               - 1
 *                               - null
 *                             nullable: true
 *                             description: DB의 boolean 값(0 또는 1)
 *                         additionalProperties: true
 *                   required:
 *                     - success
 *                     - data
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
 */
router.get('/profile', async (req: Request, res: Response) => {
    try {
        const data = await cached(cacheKey('personal_info', 'profile'), () => PersonalInfo.get());
        return ok(res, data);
    } catch (error) {
        return fail(res, error, req, '프로필 정보를 가져오는데 실패했습니다.');
    }
});

router.get('/settings', async (req: Request, res: Response) => {
    try {
        const data = await cached(cacheKey('settings', 'public'), () => SiteSettings.getPublicSettings());
        return ok(res, data);
    } catch (error) {
        return fail(res, error, req, '공개 설정 정보를 가져오는데 실패했습니다.');
    }
});

router.get('/social-links', async (req: Request, res: Response) => {
    try {
        const data = await cached(cacheKey('social_links', 'all'), () => SocialLinks.getAll());
        return ok(res, data);
    } catch (error) {
        return fail(res, error, req, '소셜 링크를 가져오는데 실패했습니다.');
    }
});

module.exports = router;
