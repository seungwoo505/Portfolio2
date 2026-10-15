import type { Request, Response, Router } from 'express';
import type { SummaryKeywordsResult } from '../../../services/gemini-ai/types';

const express = require('express');
const {
    authenticateToken,
    geminiService,
    getPlainBody,
    logAiError,
    normalizeIncludeKeywords,
    normalizeTechTags,
    preprocessContent,
    requirePermission,
    sendAiError,
    validateContent,
    verboseDebug,
    withTimeout
} = require('./common');

const router: Router = express.Router();


/**
 * @swagger
 * /admin/ai/summarize:
 *   post:
 *     summary: 본문 요약과 선택적 키워드 생성
 *     tags:
 *       - Admin - AI
 *     security:
 *       - bearerAuth: []
 *     description: >-
 *       필요 권한: blog.create. 요약 길이는 최대 160자입니다. AI 키가 없거나 모델 호출에 실패하면 대체 처리 결과를 반환합니다. includeKeywords=true이면
 *       keywords와 keywordsString도 반환합니다.
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
 *               includeKeywords:
 *                 oneOf:
 *                   - type: boolean
 *                   - type: integer
 *                     enum:
 *                       - 0
 *                       - 1
 *                   - type: string
 *                     enum:
 *                       - 'true'
 *                       - 'false'
 *                       - '1'
 *                       - '0'
 *                       - 'yes'
 *                       - 'no'
 *                       - 'on'
 *                       - 'off'
 *                 description: boolean 또는 대응하는 숫자·문자열을 허용합니다.
 *                 default: false
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
 *                     summary:
 *                       type: string
 *                     originalLength:
 *                       type: integer
 *                     summaryLength:
 *                       type: integer
 *                     keywords:
 *                       type: array
 *                       items:
 *                         type: string
 *                     keywordsString:
 *                       type: string
 *                   required:
 *                     - summary
 *                     - originalLength
 *                     - summaryLength
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
router.post('/ai/summarize',
    authenticateToken,
    requirePermission('blog.create'),
    async (req: Request, res: Response) => {
        try {
            const body = getPlainBody(req);
            const { content, techTags = [] } = body;
            const includeKeywords = normalizeIncludeKeywords(body.includeKeywords);
            const validatedContent = validateContent(content, '요약할 내용이 없습니다.');
            const normalizedTechTags = normalizeTechTags(techTags);
            const preprocessedContent = preprocessContent(validatedContent, '백엔드 전처리');

            verboseDebug('원본 콘텐츠:', content);
            verboseDebug('전처리된 콘텐츠:', preprocessedContent);

            if (includeKeywords) {
                const result = await withTimeout(
                    geminiService.generateSummaryAndKeywords(preprocessedContent, normalizedTechTags),
                    'AI 요약/키워드 생성'
                ) as SummaryKeywordsResult;

                return res.json({
                    success: true,
                    data: {
                        summary: result.summary,
                        keywords: result.keywords,
                        keywordsString: result.keywordsString,
                        originalLength: validatedContent.length,
                        summaryLength: result.summary.length
                    },
                    message: 'Gemini AI로 요약과 키워드가 생성되었습니다.'
                });
            }

            verboseDebug('AI 요약 생성 시작 - content 길이:', validatedContent.length);
            verboseDebug('techTags:', normalizedTechTags);
            verboseDebug('geminiService.generateSummary 호출 시작');
            verboseDebug('generateSummary 메서드 타입:', typeof geminiService.generateSummary);
            verboseDebug('generateSummary 메서드 내용:', geminiService.generateSummary.toString().substring(0, 100) + '...');

            const summary = await withTimeout(
                geminiService.generateSummary(preprocessedContent, 160, normalizedTechTags),
                'AI 요약 생성'
            ) as string;
            verboseDebug('generateSummary 호출 성공');

            verboseDebug('AI 요약 생성 완료 - summary 길이:', summary.length);
            verboseDebug('summary 내용:', summary.substring(0, 100) + '...');

            res.json({
                success: true,
                data: {
                    summary: summary,
                    originalLength: validatedContent.length,
                    summaryLength: summary.length
                },
                message: 'Gemini AI로 요약이 생성되었습니다.'
            });
        } catch (error) {
            logAiError(error, req, 'Gemini AI 요약 생성 실패');
            sendAiError(res, error, 'AI 요약 생성에 실패했습니다.');
        }
    }
);

module.exports = router;
