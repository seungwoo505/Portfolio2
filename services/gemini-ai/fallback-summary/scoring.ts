import type { GeminiServiceContext } from "../types";

const importantKeywords: string[] = [
    '개발', '구현', '사용', '적용', '설계', '최적화', '향상',
    '문제', '해결', '분석', '설정', '배포', '테스트',
    'React', 'Next.js', 'JavaScript', 'TypeScript'
];

const calculateSentenceScore = (sentence: string, keywords: string[], isFirst: boolean): number => {
    let score = 0;

    keywords.forEach(keyword => {
        if (sentence.includes(keyword)) score += 2;
    });

    if (sentence.length >= 20 && sentence.length <= 80) score += 1;
    if (/\d/.test(sentence)) score += 1;
    if (isFirst) score += 1;

    return score;
};

const prioritizeSentences = (sentences: string[]): string[] => (
    sentences
        .map(sentence => ({
            text: sentence,
            score: calculateSentenceScore(
                sentence,
                importantKeywords,
                sentences.indexOf(sentence) === 0
            )
        }))
        .sort((a, b) => {
            if (b.score !== a.score) return b.score - a.score;
            return Math.abs(a.text.length - 50) - Math.abs(b.text.length - 50);
        })
        .map(item => item.text)
);

function summarizeMultipleSentences(this: GeminiServiceContext, sentences: string[], maxLength: number): string {
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
}

module.exports = {
    calculateSentenceScore,
    importantKeywords,
    prioritizeSentences,
    summarizeMultipleSentences
};
