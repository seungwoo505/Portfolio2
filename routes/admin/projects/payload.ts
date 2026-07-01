type ProjectPayload = Record<string, unknown>;

const CATALOG_STATUS_TO_PROJECT_STATUS: Record<string, string> = {
    '출시 완료': 'completed',
    '제작 중': 'in_progress',
    '진행 중': 'in_progress',
    '기획 중': 'planning',
    '보류': 'on_hold',
    completed: 'completed',
    in_progress: 'in_progress',
    planning: 'planning',
    on_hold: 'on_hold',
    archived: 'archived'
};

const getTrimmedString = (value: unknown): string => (
    typeof value === 'string' ? value.trim() : ''
);

const normalizeUndefinedFields = (body: ProjectPayload): ProjectPayload => {
    const normalizedData: ProjectPayload = {};

    Object.keys(body).forEach((key) => {
        normalizedData[key] = body[key] === undefined ? null : body[key];
    });

    return normalizedData;
};

const normalizeProjectContentFields = (body: ProjectPayload): ProjectPayload => {
    const normalizedData = normalizeUndefinedFields(body);
    const catalogTitle = getTrimmedString(normalizedData.catalog_title);
    const catalogSummary = getTrimmedString(normalizedData.catalog_summary);
    const catalogStatus = getTrimmedString(normalizedData.catalog_status);

    if (!getTrimmedString(normalizedData.title) && catalogTitle) {
        normalizedData.title = catalogTitle;
    }

    if (!getTrimmedString(normalizedData.excerpt) && catalogSummary) {
        normalizedData.excerpt = catalogSummary;
    }

    if (!getTrimmedString(normalizedData.meta_description) && catalogSummary) {
        normalizedData.meta_description = catalogSummary.slice(0, 160);
    }

    if (!getTrimmedString(normalizedData.status) && catalogStatus) {
        normalizedData.status = CATALOG_STATUS_TO_PROJECT_STATUS[catalogStatus] || catalogStatus;
    }

    const description = getTrimmedString(normalizedData.description);

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
