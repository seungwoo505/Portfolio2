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
 *     summary: AI 기반 요약 생성
 *     tags: ['Admin - AI']
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: 요약 생성 성공
 *       400:
 *         description: 잘못된 요청
 *       413:
 *         description: content 길이 초과
 *       504:
 *         description: AI 응답 시간 초과
 *       500:
 *         description: 서버 오류
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
