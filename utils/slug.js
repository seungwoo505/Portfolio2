const generateSlug = (value, fallback = 'item') => {
    const slug = String(value || '')
        .toLowerCase()
        .replace(/[^a-z0-9가-힣\s-]/g, '')
        .replace(/\s+/g, '-')
        .replace(/-+/g, '-')
        .replace(/^-|-$/g, '');

    return slug || fallback;
};

const truncateSlug = (slug, maxLength) => (
    slug.length > maxLength
        ? slug.slice(0, maxLength).replace(/-+$/g, '')
        : slug
);

const buildCandidate = (baseSlug, suffix, maxLength) => {
    if (!suffix) {
        return truncateSlug(baseSlug, maxLength);
    }

    const suffixText = `-${suffix}`;
    const trimmedBase = truncateSlug(baseSlug, maxLength - suffixText.length);
    return `${trimmedBase}${suffixText}`;
};

const createUniqueSlug = async ({
    value,
    providedSlug = null,
    fallback = 'item',
    maxLength = 120,
    exists
}) => {
    const baseSlug = truncateSlug(generateSlug(providedSlug || value, fallback), maxLength);
    let suffix = 0;

    while (suffix < 1000) {
        const candidate = buildCandidate(baseSlug, suffix, maxLength);
        if (!(await exists(candidate))) {
            return candidate;
        }
        suffix += 1;
    }

    throw new Error('고유한 slug를 생성하지 못했습니다.');
};

module.exports = {
    generateSlug,
    createUniqueSlug
};
