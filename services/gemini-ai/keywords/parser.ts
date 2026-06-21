import type { GeminiServiceContext } from "../types";

const parseAndCleanKeywords = function (this: GeminiServiceContext, keywordsText: string, maxKeywords: number): string[] {
    const delimiters = /[,\n\r\-•|]/;
    const keywords = keywordsText.split(delimiters)
        .map(k => k.trim())
        .filter(k => k.length > 0)
        .map(k => this.cleanSingleKeyword(k))
        .filter(k => k && !this.isInvalidKeyword(k))
        .slice(0, maxKeywords);

    return [...new Set(keywords)];
};

const cleanSingleKeyword = (keyword: string): string => (
    keyword.replace(/^[\d\.\-\*\+\s]*/, '').replace(/['""`]/g, '').trim()
);

const isInvalidKeyword = (keyword: string): boolean => {
    const invalid = ['입니다', '있습니다', '했습니다', '됩니다', '기반의', 'js', 'css'];
    return invalid.some(inv => keyword.includes(inv)) || keyword.length < 2;
};

module.exports = {
    cleanSingleKeyword,
    isInvalidKeyword,
    parseAndCleanKeywords
};
