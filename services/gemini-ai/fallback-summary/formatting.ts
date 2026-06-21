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

    for (let i = maxLength; i > maxLength * 0.7; i--) {
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

const createKeywordBasedSummary = (text: string, _maxLength?: number): string => {
    const words = text.match(/[가-힣A-Za-z]+/g) || [];
    const techKeywords = words.filter(word =>
        ['React', 'Next', 'JavaScript', 'TypeScript', 'Node', 'CSS', 'HTML'].includes(word)
    );

    if (techKeywords.length > 0) {
        return `${techKeywords[0]}를 사용한 개발 내용입니다.`;
    }

    return '개발 관련 내용입니다.';
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
