import type { GenerativeModel, GoogleGenerativeAI as GoogleGenerativeAIClient } from "@google/generative-ai";
import type { GeminiServiceContext } from "./types";

const fallbackSummaryMethods = require('./fallback-summary');
const keywordMethods = require('./keywords');
const markdownMethods = require('./markdown');
const summaryMethods = require('./summary');
const {
    GoogleGenerativeAI,
    logger,
    verboseDebug
} = require('./common');

class GeminiService {
    apiKey: string | null;
    genAI?: GoogleGenerativeAIClient;
    model?: GenerativeModel;

    /**
     * @description Gemini AI 서비스 인스턴스를 초기화한다.
     * @returns {any} 처리 결과
     */
    constructor() {
        this.apiKey = process.env.GEMINI_API_KEY || null;

        if (this.apiKey) {
            verboseDebug('GEMINI_API_KEY 발견:', this.apiKey.substring(0, 10) + '...');
            this.genAI = new GoogleGenerativeAI(this.apiKey);
            this.model = this.genAI.getGenerativeModel({ model: "gemini-2.0-flash" });
            verboseDebug('Gemini 2.0 Flash 모델 초기화 완료');
            verboseDebug('this.model 존재 여부:', !!this.model);
        } else {
            logger.warn('\nGEMINI_API_KEY not found. Using enhanced fallback methods.');
            verboseDebug('\nGemini AI 무료 사용법:');
            verboseDebug('1. https://makersuite.google.com/app/apikey 방문');
            verboseDebug('2. Google 계정으로 로그인');
            verboseDebug('3. "Create API Key" 클릭');
            verboseDebug('4. 루트 디렉토리에 .env 파일 생성:');
            verboseDebug('   GEMINI_API_KEY=생성된_API_키');
            verboseDebug('5. 서버 재시작\n');
            verboseDebug('Gemini API는 무료이며 월 15,000 요청까지 사용 가능합니다.\n');
            verboseDebug('this.model 존재 여부:', !!this.model);
        }
    }
}

interface GeminiService extends GeminiServiceContext {}

Object.assign(
    GeminiService.prototype,
    markdownMethods,
    summaryMethods,
    fallbackSummaryMethods,
    keywordMethods
);

module.exports = new GeminiService();
