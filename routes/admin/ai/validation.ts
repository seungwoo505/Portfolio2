const { toBooleanOrNull } = require('../../../utils/filter-values');
const {
    AI_CONTENT_MAX_LENGTH,
    AI_MAX_KEYWORDS,
    AI_TECH_TAG_MAX_LENGTH,
    AI_TECH_TAGS_MAX
} = require('./config');
const { AiValidationError } = require('./errors');

type TechTagInput = string | {
    name?: unknown;
};

const parseStrictInteger = (value: unknown): number | null => {
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

const validateContent = (content: unknown, emptyMessage: string): string => {
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

const normalizeTechTags = (techTags: unknown = []): string[] => {
    if (!Array.isArray(techTags)) {
        throw new AiValidationError('techTags는 배열이어야 합니다.');
    }

    if (techTags.length > AI_TECH_TAGS_MAX) {
        throw new AiValidationError(`techTags는 최대 ${AI_TECH_TAGS_MAX}개까지 허용됩니다.`);
    }

    return techTags
        .map((tag: TechTagInput) => {
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

const normalizeMaxKeywords = (value: unknown = 10): number => {
    const parsed = parseStrictInteger(value);

    if (parsed === null || parsed < 1 || parsed > AI_MAX_KEYWORDS) {
        throw new AiValidationError(`maxKeywords는 1~${AI_MAX_KEYWORDS} 사이의 정수여야 합니다.`);
    }

    return parsed;
};

const normalizeIncludeKeywords = (value: unknown = false): boolean => {
    const normalizedValue = toBooleanOrNull(value);
    if (normalizedValue !== null) {
        return normalizedValue;
    }

    if (value === undefined || value === null || value === '') {
        return false;
    }

    throw new AiValidationError('includeKeywords는 boolean 값이어야 합니다.');
};

module.exports = {
    normalizeIncludeKeywords,
    normalizeMaxKeywords,
    normalizeTechTags,
    parseStrictInteger,
    validateContent
};
