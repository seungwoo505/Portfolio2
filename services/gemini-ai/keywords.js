const {
    logger,
    verboseDebug
} = require('./common');

module.exports = {
    /**
     * Gemini API를 사용한 키워드 추출
     */
    async extractKeywords(content, maxKeywords = 10, techTags = []) {
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

            const prompt = `다음 텍스트에서 SEO에 효과적인 키워드를 ${maxKeywords}개 이하로 추출해주세요.

키워드 선별 기준:
- 핵심 주제와 직접 관련된 구체적인 명사나 기술명
- 검색에서 실제로 사용될 가능성이 높은 단어
- 기술 용어는 정확한 영어 표기 유지 (예: React, Next.js, JavaScript)
- 한국어는 자연스러운 검색어 형태로 (예: 웹개발, 프론트엔드)
- 2-3단어로 구성된 복합 키워드도 포함 가능

제외 기준:
- 조사, 접속사, 부사 등 문법적 요소
- 너무 일반적이거나 모호한 단어
- 의미가 없는 단어나 구문

중요: 다음 기술 명칭들을 정확히 사용하세요:
${Object.entries(protectedTerms).map(([placeholder, term]) => `- ${placeholder} = ${term}`).join('\n')}

출력 형식: 키워드를 쉼표로 구분하여 나열 (예: React, 웹개발, 프론트엔드 개발, TypeScript)

텍스트:
${cleanText}

키워드:`;

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
    },

    /**
     * @description Gemini AI 서비스용 기본 키워드를 제공한다.
     * @param {*} content 입력값
     * @param {*} maxKeywords 입력값
     * @returns {any} 처리 결과
     */
    fallbackKeywords(content, maxKeywords) {
        const cleanText = this.cleanMarkdown(content);
        const techKeywords = this.extractTechKeywords(cleanText, {});
        const words = this.extractStableWords(cleanText, []);
        const phrases = this.extractPhrases(cleanText, []);

        let allKeywords = [...techKeywords, ...words, ...phrases];
        allKeywords = [...new Set(allKeywords)];
        allKeywords = allKeywords.filter(keyword => this.isValidKeyword(keyword));

        if (allKeywords.length === 0) {
            return this.getDefaultKeywords(cleanText);
        }

        return allKeywords.slice(0, maxKeywords);
    },

    /**
     * @description Gemini AI 서비스용 기술 키워드를 추출한다.
     * @param {*} text 입력값
     * @param {*} techKeywords 입력값
     * @returns {any} 처리 결과
     */
    extractTechKeywords(text, techKeywords) {
        const techTerms = ['React', 'Next.js', 'JavaScript', 'TypeScript', 'Node.js', 'CSS', 'HTML'];
        return techTerms.filter(term => text.includes(term)).slice(0, 5);
    },

    extractStableWords(text, stopWords) {
        return text.match(/[가-힣A-Za-z]{3,}/g) || [];
    },

    /**
     * @description Gemini AI 서비스용 구문을 추출한다.
     * @param {*} text 입력값
     * @param {*} stopWords 입력값
     * @returns {any} 처리 결과
     */
    extractPhrases(text, stopWords) {
        const words = text.match(/[가-힣A-Za-z\s]{6,20}/g) || [];
        return words.filter(phrase => phrase.trim().split(' ').length <= 3).slice(0, 3);
    },

    isValidKeyword(keyword) {
        return keyword && keyword.length >= 2 && keyword.length <= 20;
    },

    /**
     * @description Gemini AI 서비스의 기본 키워드를 조회한다.
     * @param {*} text 입력값
     * @returns {any} 처리 결과
     */
    getDefaultKeywords(text) {
        if (text.includes('React') || text.includes('Next')) return ['React', '웹개발'];
        if (text.includes('개발')) return ['개발', '프로그래밍'];
        return ['기술', '개발'];
    },

    /**
     * @description Gemini AI 서비스용 키워드를 파싱하고 정제한다.
     * @param {*} keywordsText 입력값
     * @param {*} maxKeywords 입력값
     * @returns {any} 처리 결과
     */
    parseAndCleanKeywords(keywordsText, maxKeywords) {
        const delimiters = /[,\n\r\-•|]/;
        let keywords = keywordsText.split(delimiters)
            .map(k => k.trim())
            .filter(k => k.length > 0)
            .map(k => this.cleanSingleKeyword(k))
            .filter(k => k && !this.isInvalidKeyword(k))
            .slice(0, maxKeywords);

        return [...new Set(keywords)];
    },

    /**
     * @description Gemini AI 서비스용 키워드를 정제한다.
     * @param {*} keyword 입력값
     * @returns {any} 처리 결과
     */
    cleanSingleKeyword(keyword) {
        return keyword.replace(/^[\d\.\-\*\+\s]*/, '').replace(/['""`]/g, '').trim();
    },

    isInvalidKeyword(keyword) {
        const invalid = ['입니다', '있습니다', '했습니다', '됩니다', '기반의', 'js', 'css'];
        return invalid.some(inv => keyword.includes(inv)) || keyword.length < 2;
    }
};
