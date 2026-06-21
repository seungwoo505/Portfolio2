import type { GenerativeModel, GoogleGenerativeAI as GoogleGenerativeAIClient } from "@google/generative-ai";

type TechTagObject = {
    name?: string;
};

export type TechTag = string | TechTagObject;
export type ProtectedTerms = Record<string, string>;

export type CleanMarkdownResult = {
    cleanText: string;
    protectedTerms: ProtectedTerms;
};

export type SummaryKeywordsResult = {
    summary: string;
    keywords: string[];
    keywordsString: string;
};

export type GeminiServiceContext = {
    apiKey?: string | null;
    genAI?: GoogleGenerativeAIClient;
    model?: GenerativeModel | null;
    cleanMarkdown(content: string): string;
    cleanMarkdownWithProtection(content: string, techTags?: TechTag[]): Promise<CleanMarkdownResult>;
    fallbackSummary(content: string, maxLength?: number): string;
    generateSummary(content: string, maxLength?: number, techTags?: TechTag[]): Promise<string>;
    extractKeywords(content: string, maxKeywords?: number, techTags?: TechTag[]): Promise<string[]>;
    fallbackKeywords(content: string, maxKeywords: number): string[];
    parseAndCleanKeywords(keywordsText: string, maxKeywords: number): string[];
    cleanSingleKeyword(keyword: string): string;
    isInvalidKeyword(keyword: string): boolean;
    extractTechKeywords(text: string, options?: unknown): string[];
    extractStableWords(text: string, options?: unknown): string[];
    extractPhrases(text: string, options?: unknown): string[];
    getDefaultKeywords(text: string): string[];
    isValidKeyword(keyword: string): boolean;
    handleShortContent(text: string, maxLength: number): string;
    handleNoSentences(text: string, maxLength: number): string;
    formatSingleSentence(sentence: string, maxLength: number): string;
    createKeywordBasedSummary(text: string, maxLength?: number): string;
    extractCleanSentences(text: string): string[];
    summarizeMultipleSentences(sentences: string[], maxLength: number): string;
    prioritizeSentences(sentences: string[]): string[];
};
