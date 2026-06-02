const { logger, verboseDebug, buildErrorLog } = require('../common');
const { authenticateToken, requirePermission } = require('../../../middleware/auth');
const { toBooleanOrNull } = require('../../../utils/filter-values');
const { getPlainBody } = require('../../../utils/request-body');
const { parseIntegerEnv } = require('../../../utils/env-number');
const geminiService = require('../../../services/gemini-ai');

const parseStrictInteger = (value) => {
    if (typeof value === 'number') {
        return Number.isSafeInteger(value) ? value : null;
    }

    if (typeof value !== 'string') {
        return null;
    }

    const normalizedValue = value.trim();
    if (!/^-?\d+$/.test(normalizedValue)) {
        return null;
    }

    const parsed = Number(normalizedValue);
    return Number.isSafeInteger(parsed) ? parsed : null;
};

const AI_CONTENT_MAX_LENGTH = parseIntegerEnv(process.env.AI_CONTENT_MAX_LENGTH, {
    fallback: 20000,
    min: 1,
    clamp: false
});
const AI_TECH_TAGS_MAX = parseIntegerEnv(process.env.AI_TECH_TAGS_MAX, {
    fallback: 30,
    min: 1,
    clamp: false
});
const AI_TECH_TAG_MAX_LENGTH = parseIntegerEnv(process.env.AI_TECH_TAG_MAX_LENGTH, {
    fallback: 80,
    min: 1,
    clamp: false
});
const AI_MAX_KEYWORDS = parseIntegerEnv(process.env.AI_MAX_KEYWORDS, {
    fallback: 20,
    min: 1,
    clamp: false
});
const AI_REQUEST_TIMEOUT = parseIntegerEnv(process.env.AI_REQUEST_TIMEOUT, {
    fallback: 15000,
    min: 1,
    clamp: false
});
const AI_ROUTE_TIMEOUT = parseIntegerEnv(process.env.AI_ROUTE_TIMEOUT, {
    fallback: Math.max(1000, AI_REQUEST_TIMEOUT - 500),
    min: 1,
    clamp: false
});

class AiValidationError extends Error {
    constructor(message, statusCode = 400) {
        super(message);
        this.name = 'AiValidationError';
        this.statusCode = statusCode;
    }
}

const validateContent = (content, emptyMessage) => {
    if (typeof content !== 'string') {
        throw new AiValidationError('content는 문자열이어야 합니다.');
    }

    if (content.trim().length < 1) {
        throw new AiValidationError(emptyMessage);
    }

    if (content.length > AI_CONTENT_MAX_LENGTH) {
        throw new AiValidationError(`content는 최대 ${AI_CONTENT_MAX_LENGTH}자까지 허용됩니다.`, 413);
    }

    return content;
};

const normalizeTechTags = (techTags = []) => {
    if (!Array.isArray(techTags)) {
        throw new AiValidationError('techTags는 배열이어야 합니다.');
    }

    if (techTags.length > AI_TECH_TAGS_MAX) {
        throw new AiValidationError(`techTags는 최대 ${AI_TECH_TAGS_MAX}개까지 허용됩니다.`);
    }

    return techTags
        .map((tag) => {
            if (typeof tag === 'string') {
                return tag.trim();
            }

            if (tag && typeof tag.name === 'string') {
                return tag.name.trim();
            }

            return '';
        })
        .filter(Boolean)
        .map((tag) => {
            if (tag.length > AI_TECH_TAG_MAX_LENGTH) {
                throw new AiValidationError(`techTags 항목은 최대 ${AI_TECH_TAG_MAX_LENGTH}자까지 허용됩니다.`);
            }

            return tag;
        });
};

const normalizeMaxKeywords = (value = 10) => {
    const parsed = parseStrictInteger(value);

    if (parsed === null || parsed < 1 || parsed > AI_MAX_KEYWORDS) {
        throw new AiValidationError(`maxKeywords는 1~${AI_MAX_KEYWORDS} 사이의 정수여야 합니다.`);
    }

    return parsed;
};

const normalizeIncludeKeywords = (value = false) => {
    const normalizedValue = toBooleanOrNull(value);
    if (normalizedValue !== null) {
        return normalizedValue;
    }

    if (value === undefined || value === null || value === '') {
        return false;
    }

    throw new AiValidationError('includeKeywords는 boolean 값이어야 합니다.');
};

const preprocessContent = (content, logLabel) => (
    content.replace(/__([^_]+)__/g, (match, projectName) => {
        verboseDebug(`${logLabel}: ${match} → ${projectName} 프로젝트`);
        return `${projectName} 프로젝트`;
    })
);

const withTimeout = async (promise, label) => {
    let timeoutId;

    const timeout = new Promise((_, reject) => {
        timeoutId = setTimeout(() => {
            const error = new Error(`${label} 요청 시간이 초과되었습니다.`);
            error.code = 'AI_ROUTE_TIMEOUT';
            reject(error);
        }, AI_ROUTE_TIMEOUT);
    });

    try {
        return await Promise.race([promise, timeout]);
    } finally {
        clearTimeout(timeoutId);
    }
};

const sendAiError = (res, error, fallbackMessage) => {
    if (error instanceof AiValidationError) {
        return res.status(error.statusCode).json({
            success: false,
            message: error.message
        });
    }

    if (error.code === 'AI_ROUTE_TIMEOUT') {
        return res.status(504).json({
            success: false,
            message: 'AI 응답 시간이 초과되었습니다. 잠시 후 다시 시도해주세요.'
        });
    }

    return res.status(500).json({
        success: false,
        message: fallbackMessage
    });
};

const logAiError = (error, req, message) => {
    if (error instanceof AiValidationError) {
        return;
    }

    const payload = buildErrorLog(error, req);
    if (error.code === 'AI_ROUTE_TIMEOUT') {
        logger.warn(message, payload);
        return;
    }

    logger.error(message, payload);
};

verboseDebug('geminiService 객체 로드됨:', typeof geminiService);
verboseDebug('geminiService.constructor.name:', geminiService.constructor.name);
verboseDebug('geminiService.generateSummary 존재 여부:', typeof geminiService.generateSummary);
verboseDebug('geminiService 객체의 모든 메서드:', Object.getOwnPropertyNames(geminiService));
verboseDebug('geminiService 객체의 프로토타입 체인:', Object.getPrototypeOf(geminiService));

module.exports = {
    authenticateToken,
    geminiService,
    getPlainBody,
    logAiError,
    normalizeIncludeKeywords,
    normalizeMaxKeywords,
    normalizeTechTags,
    preprocessContent,
    requirePermission,
    sendAiError,
    validateContent,
    verboseDebug,
    withTimeout
};
