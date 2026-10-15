import type { GeminiServiceContext, TechTag } from "./types";

const {
    logger,
    verboseDebug
} = require('./common');
const fallbackKeywordMethods = require('./keywords/fallback');
const parserMethods = require('./keywords/parser');
const { buildKeywordPrompt } = require('./keywords/prompt');

const buildErrorMetadata = (error: unknown) => ({
    error: error instanceof Error ? error.message : String(error),
    stack: error instanceof Error ? error.stack : undefined
});

const extractKeywords = async function (this: GeminiServiceContext, content: string, maxKeywords = 10, techTags: TechTag[] = []): Promise<string[]> {
    if (!this.model) {
        return this.fallbackKeywords(content, maxKeywords);
    }

    try {
        const { cleanText, protectedTerms } = await this.cleanMarkdownWithProtection(content, techTags);

        if (cleanText.length < 1) {
            throw new Error('Content too short for keyword extraction');
        }

        if (cleanText.length < 50) {
            verboseDebug('Content too short for Gemini API, using fallback method');
            return this.fallbackKeywords(content, maxKeywords);
        }

        const prompt = buildKeywordPrompt({
            cleanText,
            maxKeywords,
            protectedTerms
        });
        const result = await this.model.generateContent(prompt);
        const response = await result.response;
        const keywordsText = response.text().trim();

        verboseDebug('Gemini API 키워드 원본 응답:', keywordsText);
        verboseDebug('보호된 기술 명칭들:', protectedTerms);

        // 구분자가 포함된 기술명도 한 키워드로 유지하도록 파싱 후 복원한다.
        const keywords = [...new Set(this.parseAndCleanKeywords(keywordsText, maxKeywords).map(keyword => (
            Object.entries(protectedTerms).reduce(
                (restored, [placeholder, originalTerm]) => restored.replaceAll(placeholder, originalTerm),
                keyword
            )
        )))];

        verboseDebug('최종 파싱된 키워드:', keywords);
        return keywords.length > 0 ? keywords : this.fallbackKeywords(content, maxKeywords);

    } catch (error) {
        logger.error('Gemini API 키워드 추출 실패', buildErrorMetadata(error));
        return this.fallbackKeywords(content, maxKeywords);
    }
};

module.exports = {
    extractKeywords,
    ...fallbackKeywordMethods,
    ...parserMethods
};
