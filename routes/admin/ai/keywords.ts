import type { Request, Response, Router } from 'express';

const express = require('express');
const {
    authenticateToken,
    geminiService,
    getPlainBody,
    logAiError,
    normalizeMaxKeywords,
    normalizeTechTags,
    preprocessContent,
    requirePermission,
    sendAiError,
    validateContent,
    withTimeout
} = require('./common');

const router: Router = express.Router();


/**
 * @swagger
 * /admin/ai/keywords:
 *   post:
 *     summary: 본문 키워드 추출
 *     tags:
 *       - Admin - AI
 *     security:
 *       - bearerAuth: []
 *     description: '필요 권한: blog.create. AI 키가 없거나 모델 호출에 실패하면 대체 키워드 추출 결과를 반환합니다.'
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               content:
 *                 type: string
 *                 minLength: 1
 *                 description: 공백만 있는 입력은 거절합니다. 기본 최대 20000자이며 AI_CONTENT_MAX_LENGTH로 변경할 수 있습니다.
 *               techTags:
 *                 type: array
 *                 description: 기술명 문자열 또는 name 필드를 가진 객체. 기본 최대 30개, 항목당 80자이며 환경 변수로 변경할 수 있습니다.
 *                 items:
 *                   oneOf:
 *                     - type: string
 *                       maxLength: 80
 *                     - type: object
 *                       properties:
 *                         name:
 *                           type: string
 *                           maxLength: 80
 *                       required:
 *                         - name
 *                 example:
 *                   - Next.js
 *                   - TypeScript
 *               maxKeywords:
 *                 type: integer
 *                 minimum: 1
 *                 default: 10
 *                 description: 기본 허용 범위 1~20. AI_MAX_KEYWORDS로 최대값을 변경할 수 있으며 정수 문자열도 허용합니다.
 *             required:
 *               - content
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
 *                     keywords:
 *                       type: array
 *                       items:
 *                         type: string
 *                     keywordsString:
 *                       type: string
 *                     originalLength:
 *                       type: integer
 *                     keywordCount:
 *                       type: integer
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
 *       '413':
 *         description: 허용된 요청 또는 파일 크기 초과
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
 *       '504':
 *         description: AI 처리 시간 초과
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.post('/ai/keywords',
    authenticateToken,
    requirePermission('blog.create'),
    async (req: Request, res: Response) => {
        try {
            const body = getPlainBody(req);
            const { content, maxKeywords = 10, techTags = [] } = body;
            const validatedContent = validateContent(content, '키워드를 추출할 내용이 없습니다.');
            const normalizedMaxKeywords = normalizeMaxKeywords(maxKeywords);
            const normalizedTechTags = normalizeTechTags(techTags);
            const preprocessedContent = preprocessContent(validatedContent, '키워드 추출 전처리');

            const keywords = await withTimeout(
                geminiService.extractKeywords(preprocessedContent, normalizedMaxKeywords, normalizedTechTags),
                'AI 키워드 추출'
            ) as string[];

            res.json({
                success: true,
                data: {
                    keywords: keywords,
                    keywordsString: keywords.join(', '),
                    originalLength: validatedContent.length,
                    keywordCount: keywords.length
                },
                message: 'Gemini AI로 키워드가 추출되었습니다.'
            });

        } catch (error) {
            logAiError(error, req, 'Gemini AI 키워드 추출 실패');
            sendAiError(res, error, 'AI 키워드 추출에 실패했습니다.');
        }
    }
);

module.exports = router;
