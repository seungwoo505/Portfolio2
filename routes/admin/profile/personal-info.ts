const express = require('express');
const { logger, buildErrorLog } = require('../common');
const PersonalInfo = require('../../../models/personal-info');
const CacheUtils = require('../../../utils/cache');
const { getPlainBody } = require('../../../utils/request-body');
const { authenticateToken, requirePermission, logActivity } = require('../../../middleware/auth');

const router = express.Router();

/**
 * @swagger
 * /admin/personal-info:
 *   get:
 *     summary: 포트폴리오 개인 정보 조회
 *     tags:
 *       - Admin - Profile
 *     security:
 *       - bearerAuth: []
 *     description: '필요 권한: personal_info.read.'
 *     responses:
 *       '200':
 *         description: 성공
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
 *                 data:
 *                   type: object
 *                   properties:
 *                     name:
 *                       type: string
 *                       nullable: true
 *                     full_name:
 *                       type: string
 *                       nullable: true
 *                     title:
 *                       type: string
 *                       nullable: true
 *                     bio:
 *                       type: string
 *                       nullable: true
 *                     about:
 *                       type: string
 *                       nullable: true
 *                     email:
 *                       type: string
 *                       nullable: true
 *                     phone:
 *                       type: string
 *                       nullable: true
 *                     location:
 *                       type: string
 *                       nullable: true
 *                     avatar_url:
 *                       type: string
 *                       nullable: true
 *                     profile_image:
 *                       type: string
 *                       nullable: true
 *                     resume_url:
 *                       type: string
 *                       nullable: true
 *                     github_url:
 *                       type: string
 *                       nullable: true
 *                     linkedin_url:
 *                       type: string
 *                       nullable: true
 *                     twitter_url:
 *                       type: string
 *                       nullable: true
 *                     instagram_url:
 *                       type: string
 *                       nullable: true
 *                   nullable: true
 *                   additionalProperties: true
 *       '401':
 *         description: 인증 토큰이 없거나 유효하지 않음
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       '403':
 *         description: 필요한 권한 또는 역할 없음
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       '500':
 *         description: 서버 오류
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *   put:
 *     summary: 포트폴리오 개인 정보 일부 수정
 *     tags:
 *       - Admin - Profile
 *     security:
 *       - bearerAuth: []
 *     description: >-
 *       필요 권한: personal_info.update. 생략한 필드는 보존합니다. name과 full_name은 서로의 별칭이며 profile_image는 avatar_url의 별칭입니다.
 *       기존 레코드가 없으면 생성합니다.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *                 nullable: true
 *               full_name:
 *                 type: string
 *                 nullable: true
 *               title:
 *                 type: string
 *                 nullable: true
 *               bio:
 *                 type: string
 *                 nullable: true
 *               about:
 *                 type: string
 *                 nullable: true
 *               email:
 *                 type: string
 *                 nullable: true
 *               phone:
 *                 type: string
 *                 nullable: true
 *               location:
 *                 type: string
 *                 nullable: true
 *               avatar_url:
 *                 type: string
 *                 nullable: true
 *               profile_image:
 *                 type: string
 *                 nullable: true
 *               resume_url:
 *                 type: string
 *                 nullable: true
 *               github_url:
 *                 type: string
 *                 nullable: true
 *               linkedin_url:
 *                 type: string
 *                 nullable: true
 *               twitter_url:
 *                 type: string
 *                 nullable: true
 *               instagram_url:
 *                 type: string
 *                 nullable: true
 *             minProperties: 1
 *     responses:
 *       '200':
 *         description: 성공
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
 *                 data:
 *                   type: object
 *                   properties:
 *                     name:
 *                       type: string
 *                       nullable: true
 *                     full_name:
 *                       type: string
 *                       nullable: true
 *                     title:
 *                       type: string
 *                       nullable: true
 *                     bio:
 *                       type: string
 *                       nullable: true
 *                     about:
 *                       type: string
 *                       nullable: true
 *                     email:
 *                       type: string
 *                       nullable: true
 *                     phone:
 *                       type: string
 *                       nullable: true
 *                     location:
 *                       type: string
 *                       nullable: true
 *                     avatar_url:
 *                       type: string
 *                       nullable: true
 *                     profile_image:
 *                       type: string
 *                       nullable: true
 *                     resume_url:
 *                       type: string
 *                       nullable: true
 *                     github_url:
 *                       type: string
 *                       nullable: true
 *                     linkedin_url:
 *                       type: string
 *                       nullable: true
 *                     twitter_url:
 *                       type: string
 *                       nullable: true
 *                     instagram_url:
 *                       type: string
 *                       nullable: true
 *                   additionalProperties: true
 *       '400':
 *         description: 필수 값 누락 또는 유효하지 않은 입력
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
 *         description: 필요한 권한 또는 역할 없음
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       '500':
 *         description: 서버 오류
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.get('/personal-info',
    authenticateToken,
    requirePermission('personal_info.read'),
    async (req, res) => {
        try {
            const profile = await PersonalInfo.get();
            res.json({ success: true, data: profile });
        } catch (error) {
            logger.error('개인 정보 조회 실패', buildErrorLog(error, req));
            res.status(500).json({
                success: false,
                message: '개인 정보를 가져오는데 실패했습니다.'
            });
        }
    }
);

router.put('/personal-info',
    authenticateToken,
    requirePermission('personal_info.update'),
    logActivity('update_personal_info'),
    async (req, res) => {
        try {
            const body = getPlainBody(req);

            if (Object.keys(body).length === 0) {
                return res.status(400).json({
                    success: false,
                    message: '수정할 개인 정보가 필요합니다.'
                });
            }

            const profile = await PersonalInfo.update(body);
            CacheUtils.invalidateResources('personal_info');
            res.json({
                success: true,
                message: '개인 정보가 업데이트되었습니다.',
                data: profile
            });
        } catch (error) {
            logger.error('개인 정보 수정 실패', buildErrorLog(error, req));
            res.status(500).json({
                success: false,
                message: '개인 정보 수정에 실패했습니다.'
            });
        }
    }
);

module.exports = router;
export {};
