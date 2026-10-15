const slugSchema = {
    type: 'string',
    minLength: 1,
    maxLength: 255,
    pattern: '^[a-z0-9가-힣]+(?:-[a-z0-9가-힣]+)*$'
};
const slugPattern = new RegExp(slugSchema.pattern);

function requireSlug(args) {
    const value = args?.slug;
    if (typeof value !== 'string' || !value.trim()) {
        throw new Error('slug is required');
    }
    const slug = value.trim();
    if (slug.length > slugSchema.maxLength || !slugPattern.test(slug)) {
        throw new Error('유효한 slug가 필요합니다. (최대 255자)');
    }
    return slug;
}

module.exports = { requireSlug, slugSchema };
