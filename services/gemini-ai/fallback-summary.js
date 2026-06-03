const { verboseDebug } = require('./common');
const formattingMethods = require('./fallback-summary/formatting');
const scoringMethods = require('./fallback-summary/scoring');
const sentenceMethods = require('./fallback-summary/sentences');

const fallbackSummary = function (content, maxLength = 160) {
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
};

module.exports = {
    fallbackSummary,
    ...formattingMethods,
    ...scoringMethods,
    ...sentenceMethods
};
