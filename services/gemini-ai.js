const { GoogleGenerativeAI } = require('@google/generative-ai');
const logger = require('../log');

class GeminiService {
    /**
     * @description constructor for Gemini Ai Service.
     * @returns {any} 처리 결과
     */
    constructor() {
        this.apiKey = process.env.GEMINI_API_KEY || null;
        
        if (this.apiKey) {
            logger.debug('🔑 GEMINI_API_KEY 발견:', this.apiKey.substring(0, 10) + '...');
            this.genAI = new GoogleGenerativeAI(this.apiKey);
            this.model = this.genAI.getGenerativeModel({ model: "gemini-2.0-flash" });
            logger.debug('✅ Gemini 2.0 Flash 연결됨 - 최신 AI로 초고속 요약/키워드 생성! 🚀');
            logger.debug('📊 this.model 존재 여부:', !!this.model);
        } else {
            logger.warn('\n⚠️  GEMINI_API_KEY not found. Using enhanced fallback methods.');
            logger.debug('\n🤖 Gemini AI 무료 사용법:');
            logger.debug('1. https://makersuite.google.com/app/apikey 방문');
            logger.debug('2. Google 계정으로 로그인');
            logger.debug('3. "Create API Key" 클릭');
            logger.debug('4. 루트 디렉토리에 .env 파일 생성:');
            logger.debug('   GEMINI_API_KEY=생성된_API_키');
            logger.debug('5. 서버 재시작\n');
            logger.debug('💡 Gemini API는 무료이며 월 15,000 요청까지 사용 가능합니다.\n');
            logger.debug('📊 this.model 존재 여부:', !!this.model);
        }
    }

    /**
     * 마크다운 텍스트에서 순수 텍스트 추출 (기술 명칭 보호 없음)
     */
    cleanMarkdown(content) {
        const cleaned = content
            .replace(/```[\s\S]*?```/g, '')
            .replace(/`([^`]*)`/g, '$1') // 인라인 코드의 내용은 유지
            
            .replace(/!\[.*?\]\(.*?\)/g, '')
            
            .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
            
            .replace(/#{1,6}\s+(.+)/g, '$1')
            
            .replace(/\*\*(.*?)\*\*/g, '$1') // 볼드
            .replace(/\*(.*?)\*/g, '$1') // 이탤릭
            .replace(/~~(.*?)~~/g, '$1') // 취소선
            .replace(/_\_(.*?)_\_/g, '$1') // 언더스코어 볼드
            .replace(/_(.*?)_/g, '$1') // 언더스코어 이탤릭
            
            .replace(/^\s*[-*+]\s+/gm, '')
            .replace(/^\s*\d+\.\s+/gm, '')
            
            .replace(/^\s*>\s+/gm, '')
            
            .replace(/<[^>]*>/g, '')
            
            .replace(/\n{3,}/g, '\n\n') // 과도한 줄바꿈 정리
            .replace(/\s{2,}/g, ' ') // 연속 공백을 하나로
            .trim();

        return cleaned;
    }

    /**
     * 마크다운 텍스트에서 순수 텍스트 추출 (기술 명칭 보호 포함)
     */
    async cleanMarkdownWithProtection(content, techTags = []) {
        let techTerms = [
            'Next.js', 'React.js', 'Vue.js', 'Angular', 'Svelte',
            'Node.js', 'Express.js', 'JavaScript', 'TypeScript',
            'HTML5', 'CSS3', 'Tailwind CSS', 'Bootstrap',
            'MongoDB', 'PostgreSQL', 'MySQL', 'Redis',
            'AWS', 'Vercel', 'Netlify', 'GitHub', 'Docker'
        ];

        try {
            if (techTags && techTags.length > 0) {
                const tagNames = techTags.map(tag => tag.name || tag);
                techTerms = [...new Set([...techTerms, ...tagNames])];
                logger.debug('클라이언트 태그와 결합된 기술 명칭:', techTerms.length, '개');
            }

            try {
                const db = require('../db');
                const [rows] = await db.execute(`
                    SELECT name FROM tags 
                    WHERE type IN ('project', 'general') 
                    AND name NOT IN (${techTerms.map(() => '?').join(',')})
                `, techTerms);
                
                if (rows && rows.length > 0) {
                    const dbTechTerms = rows.map(row => row.name);
                    techTerms = [...new Set([...techTerms, ...dbTechTerms])];
                    logger.debug('DB에서 추가된 기술 명칭:', dbTechTerms.length, '개');
                }
            } catch (error) {
                logger.debug('DB에서 기술 명칭 가져오기 실패, 기본 기술 명칭만 사용:', error);
            }
        } catch (error) {
            logger.debug('기본 기술 명칭 사용 (태그 시스템 연동 실패):', error);
        }

        const protectedTerms = {};
        let protectedContent = content;
        techTerms.forEach((term, index) => {
            const placeholder = `__TECH_TERM_${index}__`;
            protectedTerms[placeholder] = term;
            protectedContent = protectedContent.replace(new RegExp(term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi'), placeholder);
        });

        const cleaned = protectedContent
            .replace(/```[\s\S]*?```/g, '')
            .replace(/`([^`]*)`/g, '$1') // 인라인 코드의 내용은 유지
            
            .replace(/!\[.*?\]\(.*?\)/g, '')
            
            .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
            
            .replace(/#{1,6}\s+(.+)/g, '$1')
            
            .replace(/\*\*(.*?)\*\*/g, '$1') // 볼드
            .replace(/\*(.*?)\*/g, '$1') // 이탤릭
            .replace(/~~(.*?)~~/g, '$1') // 취소선
            .replace(/_\_(.*?)_\_/g, '$1') // 언더스코어 볼드
            .replace(/_(.*?)_/g, '$1') // 언더스코어 이탤릭
            
            .replace(/^\s*[-*+]\s+/gm, '')
            .replace(/^\s*\d+\.\s+/gm, '')
            
            .replace(/^\s*>\s+/gm, '')
            
            .replace(/<[^>]*>/g, '')
            
            .replace(/\n{3,}/g, '\n\n') // 과도한 줄바꿈 정리
            .replace(/\s{2,}/g, ' ') // 연속 공백을 하나로
            .trim();

        return { cleanText: cleaned, protectedTerms };
    }

    /**
     * Gemini API를 사용한 텍스트 요약
     */
    async generateSummary(content, maxLength = 160, techTags = []) {
        logger.debug('=== generateSummary 시작 ===');
        logger.debug('content 길이:', content.length);
        logger.debug('maxLength:', maxLength);
        logger.debug('techTags:', techTags);
        logger.debug('this.model 존재 여부:', !!this.model);
        
        if (!this.model) {
            logger.debug('Gemini 모델이 없음, fallback 사용');
            return this.fallbackSummary(content, maxLength);
        }
        
        logger.debug('Gemini 모델 사용하여 요약 생성 시작');

        try {
            logger.debug('🔄 generateSummary try 블록 시작');
            
            const { cleanText, protectedTerms } = await this.cleanMarkdownWithProtection(content, techTags);
            
            logger.debug('원본 content 길이:', content.length);
            logger.debug('정리된 cleanText 길이:', cleanText.length);
            logger.debug('cleanText 내용:', cleanText.substring(0, 100) + '...');
            logger.debug('protectedTerms:', protectedTerms);
            
            if (cleanText.length < 1) {
                throw new Error('Content too short for AI summarization');
            }

            if (cleanText.length < 10) {
                logger.debug('Content too short for Gemini API, using fallback method');
                return this.fallbackSummary(content, maxLength);
            }

            const prompt = `다음 텍스트를 ${maxLength}자 이내로 요약해주세요.

요구사항:
- 핵심 내용만 간결하게 정리
- 자연스럽고 읽기 쉬운 문장으로 작성
- 기술적 용어가 있다면 정확히 포함
- 블로그 독자가 내용을 쉽게 이해할 수 있도록 작성
- 불필요한 접속사나 수식어는 제거

중요: 다음 기술 명칭들을 정확히 사용하세요:
${Object.entries(protectedTerms).map(([placeholder, term]) => `- ${placeholder} = ${term}`).join('\n')}

텍스트:
${cleanText}

요약:`;

            logger.debug('📝 Gemini API 프롬프트 생성 완료');
            logger.debug('📝 프롬프트 길이:', prompt.length);
            
            logger.debug('🚀 Gemini API 호출 시작');
            const result = await this.model.generateContent(prompt);
            logger.debug('🚀 Gemini API 응답 받음');
            const response = await result.response;
            let summary = response.text().trim();

            if (!summary || summary.trim().length < 5) {
                logger.debug('Gemini API 응답이 비어있거나 너무 짧음, fallback 사용');
                return this.fallbackSummary(content, maxLength);
            }

            logger.debug('Gemini API 원본 응답:', summary);
            logger.debug('보호된 기술 명칭들:', protectedTerms);

            Object.entries(protectedTerms).forEach(([placeholder, originalTerm]) => {
                summary = summary.replace(new RegExp(placeholder, 'g'), originalTerm);
            });

            logger.debug('기술 명칭 복원 후 요약:', summary);

            if (summary.length > maxLength) {
                const truncated = summary.substring(0, maxLength - 3);
                const lastPeriod = truncated.lastIndexOf('.');
                const lastExclamation = truncated.lastIndexOf('!');
                const lastQuestion = truncated.lastIndexOf('?');
                
                const lastSentenceEnd = Math.max(lastPeriod, lastExclamation, lastQuestion);
                
                if (lastSentenceEnd > maxLength * 0.7) { // 70% 이상이면 문장 끝에서 자르기
                    summary = truncated.substring(0, lastSentenceEnd + 1);
                } else {
                    summary = truncated + '...';
                }
            }

            if (!summary || summary.trim().length < 10) {
                logger.debug('요약이 너무 짧거나 비어있음, fallback 사용');
                return this.fallbackSummary(content, maxLength);
            }

            logger.debug('최종 요약:', summary);
            return summary;

        } catch (error) {
            logger.error('Gemini API 요약 생성 실패:', error);
            return this.fallbackSummary(content, maxLength);
        }
    }

    /**
     * Gemini API를 사용한 키워드 추출
     */
    async extractKeywords(content, maxKeywords = 10, techTags = []) {
        if (!this.model) {
            return this.fallbackKeywords(content, maxKeywords);
        }

        try {
            const { cleanText, protectedTerms } = await this.cleanMarkdownWithProtection(content, techTags);
            
            if (cleanText.length < 1) {
                throw new Error('Content too short for keyword extraction');
            }

            if (cleanText.length < 50) {
                logger.debug('Content too short for Gemini API, using fallback method');
                return this.fallbackKeywords(content, maxKeywords);
            }

            const prompt = `다음 텍스트에서 SEO에 효과적인 키워드를 ${maxKeywords}개 이하로 추출해주세요.

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

            const result = await this.model.generateContent(prompt);
            const response = await result.response;
            let keywordsText = response.text().trim();

            logger.debug('Gemini API 키워드 원본 응답:', keywordsText);
            logger.debug('보호된 기술 명칭들:', protectedTerms);

            Object.entries(protectedTerms).forEach(([placeholder, originalTerm]) => {
                keywordsText = keywordsText.replace(new RegExp(placeholder, 'g'), originalTerm);
            });

            logger.debug('기술 명칭 복원 후 키워드:', keywordsText);

            const keywords = this.parseAndCleanKeywords(keywordsText, maxKeywords);
            
            logger.debug('최종 파싱된 키워드:', keywords);
            return keywords.length > 0 ? keywords : this.fallbackKeywords(content, maxKeywords);

        } catch (error) {
            logger.error('Gemini API 키워드 추출 실패:', error);
            return this.fallbackKeywords(content, maxKeywords);
        }
    }

    /**
     * @description fallback Summary for Gemini Ai Service.
      * @param {*} content 입력값
      * @param {*} maxLength 입력값
     * @returns {any} 처리 결과
     */
    fallbackSummary(content, maxLength = 160) {
        logger.debug('fallbackSummary 호출됨, content 길이:', content.length);
        
        const cleanText = this.cleanMarkdown(content);
        logger.debug('fallback cleanText 길이:', cleanText.length);
        
        if (cleanText.length <= 30) {
            logger.debug('handleShortContent 호출');
            return this.handleShortContent(cleanText, maxLength);
        }
        
        const sentences = this.extractCleanSentences(cleanText);
        logger.debug('추출된 문장 수:', sentences.length);
        
        if (sentences.length === 0) {
            logger.debug('handleNoSentences 호출');
            return this.handleNoSentences(cleanText, maxLength);
        }
        
        if (sentences.length === 1) {
            logger.debug('formatSingleSentence 호출');
            return this.formatSingleSentence(sentences[0], maxLength);
        }
        
        logger.debug('summarizeMultipleSentences 호출');
        return this.summarizeMultipleSentences(sentences, maxLength);
    }

    /**
     * @description Handles Gemini Ai Service Short Content.
      * @param {*} text 입력값
      * @param {*} maxLength 입력값
     * @returns {any} 처리 결과
     */
    handleShortContent(text, maxLength) {
        let summary = text.trim();
        
        if (summary && !summary.match(/[.!?]$/)) {
            if (summary.match(/[가-힣]$/)) {
                summary += '에 대한 내용입니다.';
            } else {
                summary += '.';
            }
        }
        
        return summary.substring(0, maxLength);
    }

    /**
     * @description extract Clean Sentences for Gemini Ai Service.
      * @param {*} text 입력값
     * @returns {any} 처리 결과
     */
    extractCleanSentences(text) {
        return text
            .split(/[.!?]+/)
            .map(s => s.trim())
            .filter(s => s.length > 5)
            .filter(s => s.length < 200)
            .filter(s => !/^[0-9\s.,!?;:()]+$/.test(s))
            .filter(s => !this.isConnectorSentence(s))
            .map(s => this.cleanSentence(s));
    }

    /**
     * @description is Connector Sentence for Gemini Ai Service.
      * @param {*} sentence 입력값
     * @returns {any} 처리 결과
     */
    isConnectorSentence(sentence) {
        const connectors = ['그리고', '또한', '하지만', '그러나', '따라서', '그러므로'];
        return connectors.some(conn => sentence.trim().startsWith(conn));
    }

    /**
     * @description clean Sentence for Gemini Ai Service.
      * @param {*} sentence 입력값
     * @returns {any} 처리 결과
     */
    cleanSentence(sentence) {
        return sentence.replace(/^\s*[,-]\s*/, '').trim();
    }

    handleNoSentences(text, maxLength) {
        const phrases = this.extractPhrases(text, []);
        if (phrases.length > 0) {
            return this.createKeywordBasedSummary(text, maxLength);
        }
        return this.handleShortContent(text, maxLength);
    }

    /**
     * @description format Single Sentence for Gemini Ai Service.
      * @param {*} sentence 입력값
      * @param {*} maxLength 입력값
     * @returns {any} 처리 결과
     */
    formatSingleSentence(sentence, maxLength) {
        let formatted = sentence.trim();
        if (!formatted.match(/[.!?]$/)) {
            formatted += '.';
        }
        
        if (formatted.length > maxLength) {
            const cutPoint = this.findNaturalCutPoint(formatted, maxLength - 3);
            formatted = formatted.substring(0, cutPoint) + '...';
        }
        
        return formatted;
    }

    /**
     * @description Finds Gemini Ai Service atural Cut Point.
      * @param {*} text 입력값
      * @param {*} maxLength 입력값
     * @returns {any} 처리 결과
     */
    findNaturalCutPoint(text, maxLength) {
        if (text.length <= maxLength) return text.length;
        
        const cutPoints = [' ', ',', '.', '!', '?', ')', ']', '}'];
        
        for (let i = maxLength; i > maxLength * 0.7; i--) {
            if (cutPoints.includes(text[i])) {
                return i + 1;
            }
        }
        
        return maxLength;
    }

    /**
     * @description summarize Multiple Sentences for Gemini Ai Service.
      * @param {*} sentences 입력값
      * @param {*} maxLength 입력값
     * @returns {any} 처리 결과
     */
    summarizeMultipleSentences(sentences, maxLength) {
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

    /**
     * @description prioritize Sentences for Gemini Ai Service.
      * @param {*} sentences 입력값
     * @returns {any} 처리 결과
     */
    prioritizeSentences(sentences) {
        const importantKeywords = [
            '개발', '구현', '사용', '적용', '설계', '최적화', '향상',
            '문제', '해결', '분석', '설정', '배포', '테스트',
            'React', 'Next.js', 'JavaScript', 'TypeScript'
        ];
        
        return sentences
            .map(sentence => ({
                text: sentence,
                score: this.calculateSentenceScore(sentence, importantKeywords, sentences.indexOf(sentence) === 0)
            }))
            .sort((a, b) => {
                if (b.score !== a.score) return b.score - a.score;
                return Math.abs(a.text.length - 50) - Math.abs(b.text.length - 50);
            })
            .map(item => item.text);
    }

    /**
     * @description calculate Sentence Score for Gemini Ai Service.
      * @param {*} sentence 입력값
      * @param {*} importantKeywords 입력값
      * @param {*} isFirst 입력값
     * @returns {any} 처리 결과
     */
    calculateSentenceScore(sentence, importantKeywords, isFirst) {
        let score = 0;
        
        importantKeywords.forEach(keyword => {
            if (sentence.includes(keyword)) score += 2;
        });
        
        if (sentence.length >= 20 && sentence.length <= 80) score += 1;
        if (/\d/.test(sentence)) score += 1;
        if (isFirst) score += 1;
        
        return score;
    }

    /**
     * @description Creates Gemini Ai Service Keyword Based Summary.
      * @param {*} text 입력값
      * @param {*} maxLength 입력값
     * @returns {any} 처리 결과
     */
    createKeywordBasedSummary(text, maxLength) {
        const words = text.match(/[가-힣A-Za-z]+/g) || [];
        const techKeywords = words.filter(word => 
            ['React', 'Next', 'JavaScript', 'TypeScript', 'Node', 'CSS', 'HTML'].includes(word)
        );
        
        if (techKeywords.length > 0) {
            return `${techKeywords[0]}를 사용한 개발 내용입니다.`;
        }
        
        return '개발 관련 내용입니다.';
    }

    /**
     * @description fallback Keywords for Gemini Ai Service.
      * @param {*} content 입력값
      * @param {*} maxKeywords 입력값
     * @returns {any} 처리 결과
     */
    fallbackKeywords(content, maxKeywords) {
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
    }

    /**
     * @description extract Tech Keywords for Gemini Ai Service.
      * @param {*} text 입력값
      * @param {*} techKeywords 입력값
     * @returns {any} 처리 결과
     */
    extractTechKeywords(text, techKeywords) {
        const techTerms = ['React', 'Next.js', 'JavaScript', 'TypeScript', 'Node.js', 'CSS', 'HTML'];
        return techTerms.filter(term => text.includes(term)).slice(0, 5);
    }

    extractStableWords(text, stopWords) {
        return text.match(/[가-힣A-Za-z]{3,}/g) || [];
    }

    /**
     * @description extract Phrases for Gemini Ai Service.
      * @param {*} text 입력값
      * @param {*} stopWords 입력값
     * @returns {any} 처리 결과
     */
    extractPhrases(text, stopWords) {
        const words = text.match(/[가-힣A-Za-z\s]{6,20}/g) || [];
        return words.filter(phrase => phrase.trim().split(' ').length <= 3).slice(0, 3);
    }

    isValidKeyword(keyword) {
        return keyword && keyword.length >= 2 && keyword.length <= 20;
    }

    /**
     * @description Retrieves Gemini Ai Service Default Keywords.
      * @param {*} text 입력값
     * @returns {any} 처리 결과
     */
    getDefaultKeywords(text) {
        if (text.includes('React') || text.includes('Next')) return ['React', '웹개발'];
        if (text.includes('개발')) return ['개발', '프로그래밍'];
        return ['기술', '개발'];
    }

    /**
     * @description parse And Clean Keywords for Gemini Ai Service.
      * @param {*} keywordsText 입력값
      * @param {*} maxKeywords 입력값
     * @returns {any} 처리 결과
     */
    parseAndCleanKeywords(keywordsText, maxKeywords) {
        const delimiters = /[,\n\r\-•|]/;
        let keywords = keywordsText.split(delimiters)
            .map(k => k.trim())
            .filter(k => k.length > 0)
            .map(k => this.cleanSingleKeyword(k))
            .filter(k => k && !this.isInvalidKeyword(k))
            .slice(0, maxKeywords);
        
        return [...new Set(keywords)];
    }

    /**
     * @description clean Single Keyword for Gemini Ai Service.
      * @param {*} keyword 입력값
     * @returns {any} 처리 결과
     */
    cleanSingleKeyword(keyword) {
        return keyword.replace(/^[\d\.\-\*\+\s]*/, '').replace(/['""`]/g, '').trim();
    }

    isInvalidKeyword(keyword) {
        const invalid = ['입니다', '있습니다', '했습니다', '됩니다', '기반의', 'js', 'css'];
        return invalid.some(inv => keyword.includes(inv)) || keyword.length < 2;
    }

    /**
     * @description Generates Gemini Ai Service Summary And Keywords.
      * @param {*} content 입력값
      * @param {*} techTags 입력값
     * @returns {Promise<any>} 처리 결과
     */
    async generateSummaryAndKeywords(content, techTags = []) {
        const summary = await this.generateSummary(content, 160, techTags);
        const keywords = await this.extractKeywords(content, 10, techTags);
        
        return {
            summary,
            keywords,
            keywordsString: keywords.join(', ')
        };
    }
}

module.exports = new GeminiService();
