const normalizeUndefinedFields = (body) => {
    const normalizedData = {};

    Object.keys(body).forEach((key) => {
        normalizedData[key] = body[key] === undefined ? null : body[key];
    });

    return normalizedData;
};

const normalizeProjectContentFields = (body) => {
    const normalizedData = normalizeUndefinedFields(body);
    const description = typeof normalizedData.description === 'string'
        ? normalizedData.description.trim()
        : '';

    if (!description) {
        const fallback = [
            normalizedData.excerpt,
            normalizedData.meta_description,
            normalizedData.content_text,
            normalizedData.content
        ].find((value) => typeof value === 'string' && value.trim());

        if (fallback) {
            normalizedData.description = fallback.trim().slice(0, 500);
        }
    }

    return normalizedData;
};

module.exports = {
    normalizeProjectContentFields,
    normalizeUndefinedFields
};
