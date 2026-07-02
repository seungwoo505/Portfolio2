type ProjectPayload = Record<string, any>;

const CATALOG_STATUS_TO_PROJECT_STATUS: Record<string, string> = {
    '출시 완료': 'completed',
    '제작 중': 'in_progress',
    '진행 중': 'in_progress',
    '기획 중': 'planning',
    '보류': 'on_hold',
    '보관됨': 'archived',
    completed: 'completed',
    in_progress: 'in_progress',
    planning: 'planning',
    on_hold: 'on_hold',
    archived: 'archived'
};

const hasOwn = (object: ProjectPayload, key: string): boolean => (
    Object.prototype.hasOwnProperty.call(object, key)
);

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

const trimDeep = (value: unknown): unknown => {
    if (typeof value === 'string') {
        return value.trim();
    }

    if (Array.isArray(value)) {
        return value.map(trimDeep);
    }

    if (value && typeof value === 'object') {
        return Object.keys(value as ProjectPayload).reduce((acc, key) => {
            acc[key] = trimDeep((value as ProjectPayload)[key]);
            return acc;
        }, {} as ProjectPayload);
    }

    return value;
};

const ensureCatalogObject = (data: ProjectPayload): ProjectPayload => {
    const catalog: ProjectPayload = data.catalog && typeof data.catalog === 'object' && !Array.isArray(data.catalog)
        ? { ...data.catalog }
        : {};

    const mappings = [
        ['catalog_title', 'title'],
        ['catalog_summary', 'summary'],
        ['catalog_label', 'label'],
        ['catalog_status', 'status'],
        ['catalog_badge', 'badge'],
        ['catalog_image_url', 'image_url'],
        ['catalog_accent_color', 'accent_color'],
        ['catalog_cta_label', 'cta_label'],
        ['catalog_priority', 'priority'],
        ['price_label', 'price_label'],
        ['difficulty_label', 'difficulty_label'],
        ['impact_summary', 'impact_summary']
    ];

    mappings.forEach(([sourceKey, targetKey]) => {
        if (hasOwn(data, sourceKey) && !hasOwn(catalog, targetKey)) {
            catalog[targetKey] = data[sourceKey];
        }
    });

    if ((hasOwn(data, 'primary_metric_label') || hasOwn(data, 'primary_metric_value')) && !catalog.primary_metric) {
        catalog.primary_metric = {
            label: data.primary_metric_label,
            value: data.primary_metric_value
        };
    }

    return catalog;
};

const normalizeProjectContentFields = (body: ProjectPayload): ProjectPayload => {
    const normalizedData = normalizeUndefinedFields(trimDeep(body) as ProjectPayload);
    const catalog = ensureCatalogObject(normalizedData);

    if (Object.keys(catalog).length > 0) {
        normalizedData.catalog = catalog;
    }

    const catalogTitle = getTrimmedString(normalizedData.catalog_title || catalog.title);
    const catalogSummary = getTrimmedString(normalizedData.catalog_summary || catalog.summary);
    const catalogStatus = getTrimmedString(normalizedData.catalog_status || catalog.status);

    if (!getTrimmedString(normalizedData.title) && catalogTitle) {
        normalizedData.title = catalogTitle;
    }

    if (!getTrimmedString(normalizedData.summary) && catalogSummary) {
        normalizedData.summary = catalogSummary;
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
            normalizedData.summary,
            normalizedData.content_text,
            catalogSummary
        ].find((value): value is string => typeof value === 'string' && value.trim().length > 0);

        if (fallback) {
            normalizedData.description = fallback.trim();
        }
    }

    return normalizedData;
};

module.exports = {
    getTrimmedString,
    normalizeProjectContentFields,
    normalizeUndefinedFields,
    trimDeep
};

export {};
