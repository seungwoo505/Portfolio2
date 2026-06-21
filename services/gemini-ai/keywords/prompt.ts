import type { ProtectedTerms } from "../types";

type KeywordPromptOptions = {
    cleanText: string;
    maxKeywords: number;
    protectedTerms: ProtectedTerms;
};

const buildKeywordPrompt = ({ cleanText, maxKeywords, protectedTerms }: KeywordPromptOptions): string => `다음 텍스트에서 SEO에 효과적인 키워드를 ${maxKeywords}개 이하로 추출해주세요.

키워드 선별 기준:
- 핵심 주제와 직접 관련된 구체적인 명사나 기술명
- 검색에서 실제로 사용될 가능성이 높은 단어
- 기술 용어는 정확한 영어 표기 유지 (예: React, Next.js, JavaScript)
- 한국어는 자연스러운 검색어 형태로 (예: 웹개발, 프론트엔드)
- 2-3단어로 구성된 복합 키워드도 포함 가능

제외 기준:
- 조사, 접속사, 부사 등 문법적 요소
- 너무 일반적이거나 모호한 단어
- 의미가 없는 단어나 구문

중요: 다음 기술 명칭들을 정확히 사용하세요:
${Object.entries(protectedTerms).map(([placeholder, term]) => `- ${placeholder} = ${term}`).join('\n')}

출력 형식: 키워드를 쉼표로 구분하여 나열 (예: React, 웹개발, 프론트엔드 개발, TypeScript)

텍스트:
${cleanText}

키워드:`;

module.exports = {
    buildKeywordPrompt
};
