const isConnectorSentence = (sentence) => {
    const connectors = ['그리고', '또한', '하지만', '그러나', '따라서', '그러므로'];
    return connectors.some(conn => sentence.trim().startsWith(conn));
};

const cleanSentence = (sentence) => sentence.replace(/^\s*[,-]\s*/, '').trim();

const extractCleanSentences = (text) => (
    text
        .split(/[.!?]+/)
        .map(s => s.trim())
        .filter(s => s.length > 5)
        .filter(s => s.length < 200)
        .filter(s => !/^[0-9\s.,!?;:()]+$/.test(s))
        .filter(s => !isConnectorSentence(s))
        .map(cleanSentence)
);

module.exports = {
    cleanSentence,
    extractCleanSentences,
    isConnectorSentence
};
