const express = require('express');
const router = express.Router();
const { logger, verboseDebug, buildErrorLog } = require('./common');
const { authenticateToken, requirePermission } = require('../../middleware/auth');


const geminiService = require('../../services/gemini-ai');

verboseDebug('geminiService 객체 로드됨:', typeof geminiService);
verboseDebug('geminiService.constructor.name:', geminiService.constructor.name);
verboseDebug('geminiService.generateSummary 존재 여부:', typeof geminiService.generateSummary);
verboseDebug('geminiService 객체의 모든 메서드:', Object.getOwnPropertyNames(geminiService));
verboseDebug('geminiService 객체의 프로토타입 체인:', Object.getPrototypeOf(geminiService));

/**
 * @swagger
 * /api/admin/ai/summarize:
 *   post:
 *     summary: AI 기반 요약 생성
 *     tags: ['Admin - AI']
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - content
 *             properties:
 *               content:
 *                 type: string
 *                 example: "요약을 생성할 텍스트 본문"
 *               includeKeywords:
 *                 type: boolean
 *                 example: true
 *               techTags:
 *                 type: array
 *                 items:
 *                   type: string
 *     responses:
 *       200:
 *         description: 요약 생성 성공
 *       400:
 *         description: 잘못된 요청
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       500:
 *         description: 서버 오류
 */
router.post('/ai/summarize',
    authenticateToken,
    requirePermission('blog.create'),
    async (req, res) => {
        try {
            const { content, includeKeywords = false, techTags = [] } = req.body;

            if (!content || content.trim().length < 1) {
                return res.status(400).json({
                    success: false,
                    message: '요약할 내용이 없습니다.'
                });
            }

            const preprocessedContent = content.replace(/__([^_]+)__/g, (match, projectName) => {
                verboseDebug(` 백엔드 전처리: ${match} → ${projectName} 프로젝트`);
                return `${projectName} 프로젝트`;
            });

            verboseDebug('원본 콘텐츠:', content);
            verboseDebug('전처리된 콘텐츠:', preprocessedContent);

            let result;

            if (includeKeywords) {
                result = await geminiService.generateSummaryAndKeywords(preprocessedContent, techTags);

                res.json({
                    success: true,
                    data: {
                        summary: result.summary,
                        keywords: result.keywords,
                        keywordsString: result.keywordsString,
                        originalLength: content.length,
                        summaryLength: result.summary.length
                    },
                    message: 'Gemini AI로 요약과 키워드가 생성되었습니다.'
                });
            } else {
                verboseDebug('AI 요약 생성 시작 - content 길이:', content.length);
                verboseDebug('techTags:', techTags);
                verboseDebug('geminiService.generateSummary 호출 시작');
                verboseDebug('generateSummary 메서드 타입:', typeof geminiService.generateSummary);
                verboseDebug('generateSummary 메서드 내용:', geminiService.generateSummary.toString().substring(0, 100) + '...');

                let summary;
                try {
                    summary = await geminiService.generateSummary(preprocessedContent, 160, techTags);
                    verboseDebug('generateSummary 호출 성공');
                } catch (error) {
                    logger.error('AI 요약 생성 호출 실패', buildErrorLog(error, req));
                    throw error;
                }

                verboseDebug('AI 요약 생성 완료 - summary 길이:', summary.length);
                verboseDebug('summary 내용:', summary.substring(0, 100) + '...');

                res.json({
                    success: true,
                    data: {
                        summary: summary,
                        originalLength: content.length,
                        summaryLength: summary.length
                    },
                    message: 'Gemini AI로 요약이 생성되었습니다.'
                });
            }

        } catch (error) {
            logger.error('Gemini AI 요약 생성 실패', buildErrorLog(error, req));
            res.status(500).json({
                success: false,
                message: 'AI 요약 생성에 실패했습니다.'
            });
        }
    }
);

/**
 * @swagger
 * /api/admin/ai/keywords:
 *   post:
 *     summary: AI 기반 키워드 추출
 *     tags: ['Admin - AI']
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - content
 *             properties:
 *               content:
 *                 type: string
 *               maxKeywords:
 *                 type: integer
 *                 example: 10
 *               techTags:
 *                 type: array
 *                 items:
 *                   type: string
 *     responses:
 *       200:
 *         description: 키워드 추출 성공
 *       400:
 *         description: 잘못된 요청
 *       500:
 *         description: 서버 오류
 */
router.post('/ai/keywords',
    authenticateToken,
    requirePermission('blog.create'),
    async (req, res) => {
        try {
            const { content, maxKeywords = 10, techTags = [] } = req.body;

            if (!content || content.trim().length < 1) {
                return res.status(400).json({
                    success: false,
                    message: '키워드를 추출할 내용이 없습니다.'
                });
            }

            const preprocessedContent = content.replace(/__([^_]+)__/g, (match, projectName) => {
                verboseDebug(` 키워드 추출 전처리: ${match} → ${projectName} 프로젝트`);
                return `${projectName} 프로젝트`;
            });

            const keywords = await geminiService.extractKeywords(preprocessedContent, maxKeywords, techTags);

            res.json({
                success: true,
                data: {
                    keywords: keywords,
                    keywordsString: keywords.join(', '),
                    originalLength: content.length,
                    keywordCount: keywords.length
                },
                message: 'Gemini AI로 키워드가 추출되었습니다.'
            });

        } catch (error) {
            logger.error('Gemini AI 키워드 추출 실패', buildErrorLog(error, req));
            res.status(500).json({
                success: false,
                message: 'AI 키워드 추출에 실패했습니다.'
            });
        }
    }
);

module.exports = router;

