const { verboseDebug } = require('./common');

module.exports = {
    /**
     * @description Gemini AI 서비스용 기본 요약을 제공한다.
     * @param {*} content 입력값
     * @param {*} maxLength 입력값
     * @returns {any} 처리 결과
     */
    fallbackSummary(content, maxLength = 160) {
        verboseDebug('fallbackSummary 호출됨, content 길이:', content.length);

        const cleanText = this.cleanMarkdown(content);
        verboseDebug('fallback cleanText 길이:', cleanText.length);

        if (cleanText.length <= 30) {
            verboseDebug('handleShortContent 호출');
            return this.handleShortContent(cleanText, maxLength);
        }

        const sentences = this.extractCleanSentences(cleanText);
        verboseDebug('추출된 문장 수:', sentences.length);

        if (sentences.length === 0) {
            verboseDebug('handleNoSentences 호출');
            return this.handleNoSentences(cleanText, maxLength);
        }

        if (sentences.length === 1) {
            verboseDebug('formatSingleSentence 호출');
            return this.formatSingleSentence(sentences[0], maxLength);
        }

        verboseDebug('summarizeMultipleSentences 호출');
        return this.summarizeMultipleSentences(sentences, maxLength);
    },

    /**
     * @description Gemini AI 서비스에서 짧은 콘텐츠를 처리한다.
     * @param {*} text 입력값
     * @param {*} maxLength 입력값
     * @returns {any} 처리 결과
     */
    handleShortContent(text, maxLength) {
        let summary = text.trim();

        if (summary && !summary.match(/[.!?]$/)) {
            if (summary.match(/[가-힣]$/)) {
                summary += '에 대한 내용입니다.';
            } else {
                summary += '.';
            }
        }

        return summary.substring(0, maxLength);
    },

    /**
     * @description Gemini AI 서비스용 정제된 문장을 추출한다.
     * @param {*} text 입력값
     * @returns {any} 처리 결과
     */
    extractCleanSentences(text) {
        return text
            .split(/[.!?]+/)
            .map(s => s.trim())
            .filter(s => s.length > 5)
            .filter(s => s.length < 200)
            .filter(s => !/^[0-9\s.,!?;:()]+$/.test(s))
            .filter(s => !this.isConnectorSentence(s))
            .map(s => this.cleanSentence(s));
    },

    /**
     * @description Gemini AI 서비스에서 연결 문장 여부를 판단한다.
     * @param {*} sentence 입력값
     * @returns {any} 처리 결과
     */
    isConnectorSentence(sentence) {
        const connectors = ['그리고', '또한', '하지만', '그러나', '따라서', '그러므로'];
        return connectors.some(conn => sentence.trim().startsWith(conn));
    },

    /**
     * @description Gemini AI 서비스용 문장을 정제한다.
     * @param {*} sentence 입력값
     * @returns {any} 처리 결과
     */
    cleanSentence(sentence) {
        return sentence.replace(/^\s*[,-]\s*/, '').trim();
    },

    handleNoSentences(text, maxLength) {
        const phrases = this.extractPhrases(text, []);
        if (phrases.length > 0) {
            return this.createKeywordBasedSummary(text, maxLength);
        }
        return this.handleShortContent(text, maxLength);
    },

    /**
     * @description Gemini AI 서비스용 문장을 포맷한다.
     * @param {*} sentence 입력값
     * @param {*} maxLength 입력값
     * @returns {any} 처리 결과
     */
    formatSingleSentence(sentence, maxLength) {
        let formatted = sentence.trim();
        if (!formatted.match(/[.!?]$/)) {
            formatted += '.';
        }

        if (formatted.length > maxLength) {
            const cutPoint = this.findNaturalCutPoint(formatted, maxLength - 3);
            formatted = formatted.substring(0, cutPoint) + '...';
        }

        return formatted;
    },

    /**
     * @description Gemini AI 서비스 요약을 위한 자연스러운 분기점을 찾는다.
     * @param {*} text 입력값
     * @param {*} maxLength 입력값
     * @returns {any} 처리 결과
     */
    findNaturalCutPoint(text, maxLength) {
        if (text.length <= maxLength) return text.length;

        const cutPoints = [' ', ',', '.', '!', '?', ')', ']', '}'];

        for (let i = maxLength; i > maxLength * 0.7; i--) {
            if (cutPoints.includes(text[i])) {
                return i + 1;
            }
        }

        return maxLength;
    },

    /**
     * @description Gemini AI 서비스에서 여러 문장을 요약한다.
     * @param {*} sentences 입력값
     * @param {*} maxLength 입력값
     * @returns {any} 처리 결과
     */
    summarizeMultipleSentences(sentences, maxLength) {
        const prioritized = this.prioritizeSentences(sentences);
        let summary = '';
        let remainingLength = maxLength;

        for (const sentence of prioritized) {
            if (sentence.length < remainingLength) {
                if (summary) summary += ' 또한 ';
                summary += sentence;
                remainingLength -= sentence.length + 4;
            } else {
                break;
            }
        }

        if (!summary.match(/[.!?]$/)) {
            summary += '.';
        }

        return summary;
    },

    /**
     * @description Gemini AI 서비스에서 문장의 우선순위를 계산한다.
     * @param {*} sentences 입력값
     * @returns {any} 처리 결과
     */
    prioritizeSentences(sentences) {
        const importantKeywords = [
            '개발', '구현', '사용', '적용', '설계', '최적화', '향상',
            '문제', '해결', '분석', '설정', '배포', '테스트',
            'React', 'Next.js', 'JavaScript', 'TypeScript'
        ];

        return sentences
            .map(sentence => ({
                text: sentence,
                score: this.calculateSentenceScore(sentence, importantKeywords, sentences.indexOf(sentence) === 0)
            }))
            .sort((a, b) => {
                if (b.score !== a.score) return b.score - a.score;
                return Math.abs(a.text.length - 50) - Math.abs(b.text.length - 50);
            })
            .map(item => item.text);
    },

    /**
     * @description Gemini AI 서비스에서 문장 점수를 계산한다.
     * @param {*} sentence 입력값
     * @param {*} importantKeywords 입력값
     * @param {*} isFirst 입력값
     * @returns {any} 처리 결과
     */
    calculateSentenceScore(sentence, importantKeywords, isFirst) {
        let score = 0;

        importantKeywords.forEach(keyword => {
            if (sentence.includes(keyword)) score += 2;
        });

        if (sentence.length >= 20 && sentence.length <= 80) score += 1;
        if (/\d/.test(sentence)) score += 1;
        if (isFirst) score += 1;

        return score;
    },

    /**
     * @description Gemini AI 서비스에서 키워드 기반 요약을 생성한다.
     * @param {*} text 입력값
     * @param {*} maxLength 입력값
     * @returns {any} 처리 결과
     */
    createKeywordBasedSummary(text, maxLength) {
        const words = text.match(/[가-힣A-Za-z]+/g) || [];
        const techKeywords = words.filter(word =>
            ['React', 'Next', 'JavaScript', 'TypeScript', 'Node', 'CSS', 'HTML'].includes(word)
        );

        if (techKeywords.length > 0) {
            return `${techKeywords[0]}를 사용한 개발 내용입니다.`;
        }

        return '개발 관련 내용입니다.';
    }
};
