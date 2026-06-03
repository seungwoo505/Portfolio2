const fallbackKeywords = function (content, maxKeywords) {
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

const extractTechKeywords = (text) => {
    const techTerms = ['React', 'Next.js', 'JavaScript', 'TypeScript', 'Node.js', 'CSS', 'HTML'];
    return techTerms.filter(term => text.includes(term)).slice(0, 5);
};

const extractStableWords = (text) => text.match(/[가-힣A-Za-z]{3,}/g) || [];

const extractPhrases = (text) => {
    const words = text.match(/[가-힣A-Za-z\s]{6,20}/g) || [];
    return words.filter(phrase => phrase.trim().split(' ').length <= 3).slice(0, 3);
};

const isValidKeyword = (keyword) => keyword && keyword.length >= 2 && keyword.length <= 20;

const getDefaultKeywords = (text) => {
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
