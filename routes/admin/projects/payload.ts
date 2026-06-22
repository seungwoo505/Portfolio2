type ProjectPayload = Record<string, unknown>;

const normalizeUndefinedFields = (body: ProjectPayload): ProjectPayload => {
    const normalizedData: ProjectPayload = {};

    Object.keys(body).forEach((key) => {
        normalizedData[key] = body[key] === undefined ? null : body[key];
    });

    return normalizedData;
};

const normalizeProjectContentFields = (body: ProjectPayload): ProjectPayload => {
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
    ].find((value): value is string => typeof value === 'string' && value.trim().length > 0);

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

export {};
