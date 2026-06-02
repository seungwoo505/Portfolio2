const {
    logger,
    verboseDebug
} = require('./common');

module.exports = {
    /**
     * Gemini API를 사용한 텍스트 요약
     */
    async generateSummary(content, maxLength = 160, techTags = []) {
        verboseDebug('=== generateSummary 시작 ===');
        verboseDebug('content 길이:', content.length);
        verboseDebug('maxLength:', maxLength);
        verboseDebug('techTags:', techTags);
        verboseDebug('this.model 존재 여부:', !!this.model);

        if (!this.model) {
            verboseDebug('Gemini 모델이 없음, fallback 사용');
            return this.fallbackSummary(content, maxLength);
        }

        verboseDebug('Gemini 모델 사용하여 요약 생성 시작');

        try {
            verboseDebug('generateSummary try 블록 시작');

            const { cleanText, protectedTerms } = await this.cleanMarkdownWithProtection(content, techTags);

            verboseDebug('원본 content 길이:', content.length);
            verboseDebug('정리된 cleanText 길이:', cleanText.length);
            verboseDebug('cleanText 내용:', cleanText.substring(0, 100) + '...');
            verboseDebug('protectedTerms:', protectedTerms);

            if (cleanText.length < 1) {
                throw new Error('Content too short for AI summarization');
            }

            if (cleanText.length < 10) {
                verboseDebug('Content too short for Gemini API, using fallback method');
                return this.fallbackSummary(content, maxLength);
            }

            const prompt = `다음 텍스트를 ${maxLength}자 이내로 요약해주세요.

요구사항:
- 핵심 내용만 간결하게 정리
- 자연스럽고 읽기 쉬운 문장으로 작성
- 기술적 용어가 있다면 정확히 포함
- 블로그 독자가 내용을 쉽게 이해할 수 있도록 작성
- 불필요한 접속사나 수식어는 제거

중요: 다음 기술 명칭들을 정확히 사용하세요:
${Object.entries(protectedTerms).map(([placeholder, term]) => `- ${placeholder} = ${term}`).join('\n')}

텍스트:
${cleanText}

요약:`;

            verboseDebug('Gemini API 프롬프트 생성 완료');
            verboseDebug('프롬프트 길이:', prompt.length);

            verboseDebug('Gemini API 호출 시작');
            const result = await this.model.generateContent(prompt);
            verboseDebug('Gemini API 응답 완료');
            const response = await result.response;
            let summary = response.text().trim();

            if (!summary || summary.trim().length < 5) {
                verboseDebug('Gemini API 응답이 비어있거나 너무 짧음, fallback 사용');
                return this.fallbackSummary(content, maxLength);
            }

            verboseDebug('Gemini API 원본 응답:', summary);
            verboseDebug('보호된 기술 명칭들:', protectedTerms);

            Object.entries(protectedTerms).forEach(([placeholder, originalTerm]) => {
                summary = summary.replace(new RegExp(placeholder, 'g'), originalTerm);
            });

            verboseDebug('기술 명칭 복원 후 요약:', summary);

            if (summary.length > maxLength) {
                const truncated = summary.substring(0, maxLength - 3);
                const lastPeriod = truncated.lastIndexOf('.');
                const lastExclamation = truncated.lastIndexOf('!');
                const lastQuestion = truncated.lastIndexOf('?');
                const lastSentenceEnd = Math.max(lastPeriod, lastExclamation, lastQuestion);

                if (lastSentenceEnd > maxLength * 0.7) {
                    summary = truncated.substring(0, lastSentenceEnd + 1);
                } else {
                    summary = truncated + '...';
                }
            }

            if (!summary || summary.trim().length < 10) {
                verboseDebug('요약이 너무 짧거나 비어있음, fallback 사용');
                return this.fallbackSummary(content, maxLength);
            }

            verboseDebug('최종 요약:', summary);
            return summary;

        } catch (error) {
            logger.error('Gemini API 요약 생성 실패', { error: error.message, stack: error.stack });
            return this.fallbackSummary(content, maxLength);
        }
    },

    /**
     * @description Gemini AI 서비스에서 요약과 키워드를 생성한다.
     * @param {*} content 입력값
     * @param {*} techTags 입력값
     * @returns {Promise<any>} 처리 결과
     */
    async generateSummaryAndKeywords(content, techTags = []) {
        const summary = await this.generateSummary(content, 160, techTags);
        const keywords = await this.extractKeywords(content, 10, techTags);

        return {
            summary,
            keywords,
            keywordsString: keywords.join(', ')
        };
    }
};
