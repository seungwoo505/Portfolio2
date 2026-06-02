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

const router = express.Router();

/**
 * @swagger
 * /api/admin/ai/keywords:
 *   post:
 *     summary: AI 기반 키워드 추출
 *     tags: ['Admin - AI']
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: 키워드 추출 성공
 *       400:
 *         description: 잘못된 요청
 *       413:
 *         description: content 길이 초과
 *       504:
 *         description: AI 응답 시간 초과
 *       500:
 *         description: 서버 오류
 */
router.post('/ai/keywords',
    authenticateToken,
    requirePermission('blog.create'),
    async (req, res) => {
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
            );

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
