import type { GeminiServiceContext } from "../types";

const handleShortContent = (text: string, maxLength: number): string => {
    let summary = text.trim();

    if (summary && !summary.match(/[.!?]$/)) {
        if (summary.match(/[가-힣]$/)) {
            summary += '에 대한 내용입니다.';
        } else {
            summary += '.';
        }
    }

    return summary.substring(0, maxLength);
};

const findNaturalCutPoint = (text: string, maxLength: number): number => {
    if (text.length <= maxLength) return text.length;

    const cutPoints = [' ', ',', '.', '!', '?', ')', ']', '}'];

    for (let i = maxLength - 1; i > maxLength * 0.7; i--) {
        if (cutPoints.includes(text[i])) {
            return i + 1;
        }
    }

    return maxLength;
};

const formatSingleSentence = (sentence: string, maxLength: number): string => {
    let formatted = sentence.trim();
    if (!formatted.match(/[.!?]$/)) {
        formatted += '.';
    }

    if (formatted.length > maxLength) {
        const cutPoint = findNaturalCutPoint(formatted, maxLength - 3);
        formatted = formatted.substring(0, cutPoint) + '...';
    }

    return formatted;
};

const createKeywordBasedSummary = (text: string, maxLength = 160): string => {
    // 기술명 내부의 점과 연결 문자를 유지해 Next.js를 Next로 줄이지 않는다.
    const words = text.match(/\.?[A-Za-z][A-Za-z0-9]*(?:[._-][A-Za-z0-9]+)*/g) || [];
    const techKeywords = words.filter(word =>
        ['React', 'Next.js', 'Next', 'JavaScript', 'TypeScript', 'Node.js', 'Node', '.NET', 'CSS', 'HTML'].includes(word)
    );
    const summary = techKeywords.length > 0
        ? `${techKeywords[0]}를 사용한 개발 내용입니다.`
        : '개발 관련 내용입니다.';
    return summary.substring(0, maxLength);
};

function handleNoSentences(this: GeminiServiceContext, text: string, maxLength: number): string {
    const phrases = this.extractPhrases(text, []);
    if (phrases.length > 0) {
        return this.createKeywordBasedSummary(text, maxLength);
    }
    return this.handleShortContent(text, maxLength);
}

module.exports = {
    createKeywordBasedSummary,
    findNaturalCutPoint,
    formatSingleSentence,
    handleNoSentences,
    handleShortContent
};
