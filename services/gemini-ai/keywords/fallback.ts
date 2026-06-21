import type { GeminiServiceContext } from "../types";

const fallbackKeywords = function (this: GeminiServiceContext, content: string, maxKeywords: number): string[] {
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
};

const extractTechKeywords = (text: string, _options?: unknown): string[] => {
    const techTerms = ['React', 'Next.js', 'JavaScript', 'TypeScript', 'Node.js', 'CSS', 'HTML'];
    return techTerms.filter(term => text.includes(term)).slice(0, 5);
};

const extractStableWords = (text: string, _options?: unknown): string[] => text.match(/[가-힣A-Za-z]{3,}/g) || [];

const extractPhrases = (text: string, _options?: unknown): string[] => {
    const words = text.match(/[가-힣A-Za-z\s]{6,20}/g) || [];
    return words.filter(phrase => phrase.trim().split(' ').length <= 3).slice(0, 3);
};

const isValidKeyword = (keyword: string): boolean => Boolean(keyword && keyword.length >= 2 && keyword.length <= 20);

const getDefaultKeywords = (text: string): string[] => {
    if (text.includes('React') || text.includes('Next')) return ['React', '웹개발'];
    if (text.includes('개발')) return ['개발', '프로그래밍'];
    return ['기술', '개발'];
};

module.exports = {
    extractPhrases,
    extractStableWords,
    extractTechKeywords,
    fallbackKeywords,
    getDefaultKeywords,
    isValidKeyword
};
