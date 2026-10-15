const getTagNamesError = (value: unknown): string | null => {
    if (value == null || typeof value === 'string'
        || (Array.isArray(value) && value.every(name => typeof name === 'string'))) return null;
    return '태그는 쉼표로 구분한 문자열 또는 문자열 배열이어야 합니다.';
};

const normalizeTagNames = (value: unknown): string[] => {
    const error = getTagNamesError(value);
    if (error) throw Object.assign(new TypeError(error), { code: 'INVALID_TAG_NAMES' });
    if (Array.isArray(value)) return value;
    return typeof value === 'string' ? value.split(',') : [];
};

module.exports = { getTagNamesError, normalizeTagNames };
export {};
