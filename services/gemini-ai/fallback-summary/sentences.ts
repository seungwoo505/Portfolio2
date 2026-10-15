const isConnectorSentence = (sentence: string): boolean => {
    const connectors = ['그리고', '또한', '하지만', '그러나', '따라서', '그러므로'];
    return connectors.some(conn => sentence.trim().startsWith(conn));
};

const cleanSentence = (sentence: string): string => sentence.replace(/^\s*[,-]\s*/, '').trim();

const extractCleanSentences = (text: string): string[] => (
    text
        // 기술명과 버전의 내부 점(Next.js, .NET, 20.5)은 문장 종결 부호가 아니다.
        .split(/[!?]+|\.+(?=\s|$)|(?<=[가-힣])\.+/)
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
