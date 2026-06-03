const {
    logger,
    verboseDebug
} = require('./common');
const fallbackKeywordMethods = require('./keywords/fallback');
const parserMethods = require('./keywords/parser');
const { buildKeywordPrompt } = require('./keywords/prompt');

const extractKeywords = async function (content, maxKeywords = 10, techTags = []) {
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
        let keywordsText = response.text().trim();

        verboseDebug('Gemini API 키워드 원본 응답:', keywordsText);
        verboseDebug('보호된 기술 명칭들:', protectedTerms);

        Object.entries(protectedTerms).forEach(([placeholder, originalTerm]) => {
            keywordsText = keywordsText.replace(new RegExp(placeholder, 'g'), originalTerm);
        });

        verboseDebug('기술 명칭 복원 후 키워드:', keywordsText);

        const keywords = this.parseAndCleanKeywords(keywordsText, maxKeywords);

        verboseDebug('최종 파싱된 키워드:', keywords);
        return keywords.length > 0 ? keywords : this.fallbackKeywords(content, maxKeywords);

    } catch (error) {
        logger.error('Gemini API 키워드 추출 실패', { error: error.message, stack: error.stack });
        return this.fallbackKeywords(content, maxKeywords);
    }
};

module.exports = {
    extractKeywords,
    ...fallbackKeywordMethods,
    ...parserMethods
};
