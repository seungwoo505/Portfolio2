type ProjectPayload = Record<string, any>;

const { isValidSlug } = require('../../../utils/slug');

const VALID_IMAGE_TYPES = ['catalog', 'cover', 'gallery', 'detail', 'og'];
const VALID_LINK_TYPES = ['demo', 'github', 'docs', 'case_study', 'figma', 'download', 'other'];
const VALID_SKILL_IMPORTANCE = ['primary', 'secondary', 'supporting'];

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

const trimString = (value: unknown): unknown => (
    typeof value === 'string' ? value.trim() : value
);

const isPlainObject = (value: unknown): value is ProjectPayload => (
    Boolean(value) && typeof value === 'object' && !Array.isArray(value)
);

const parseOptionalInteger = (value: unknown, fieldName: string, fallback: number | null = null): ProjectPayload => {
    if (value === undefined || value === null || value === '') {
        return {
            value: fallback
        };
    }

    const normalized = String(value).trim();
    if (!/^\d+$/.test(normalized)) {
        return {
            error: `${fieldName} 값은 0 이상의 정수여야 합니다.`
        };
    }

    const parsed = Number(normalized);
    if (!Number.isSafeInteger(parsed)) {
        return {
            error: `${fieldName} 값은 0 이상의 정수여야 합니다.`
        };
    }

    return {
        value: parsed
    };
};

const parseOptionalBoolean = (value: unknown, fieldName: string, fallback = false): ProjectPayload => {
    if (value === undefined || value === null || value === '') {
        return {
            value: fallback
        };
    }

    if (value === true || value === false) {
        return {
            value
        };
    }

    const normalized = String(value).trim().toLowerCase();
    if (['true', '1', 'yes', 'on'].includes(normalized)) {
        return {
            value: true
        };
    }
    if (['false', '0', 'no', 'off'].includes(normalized)) {
        return {
            value: false
        };
    }

    return {
        error: `${fieldName} 값은 boolean이어야 합니다.`
    };
};

const normalizeArrayField = (value: unknown, fieldName: string): ProjectPayload => {
    if (!Array.isArray(value)) {
        return {
            error: `${fieldName} 배열이 필요합니다.`
        };
    }

    return {
        items: value
    };
};

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

const parseImagesArray = (value: unknown, fieldName = 'images'): ProjectPayload => {
    const normalized = normalizeArrayField(value, fieldName);
    if (normalized.error) {
        return normalized;
    }

    const images = [];

    for (const [index, image] of normalized.items.entries()) {
        if (!isPlainObject(image)) {
            return {
                error: `${fieldName} 항목은 객체여야 합니다.`
            };
        }

        const imageUrl = getTrimmedString(image.image_url || image.url);
        if (!imageUrl) {
            return {
                error: 'image_url은 필수입니다.'
            };
        }

        const imageType = getTrimmedString(image.image_type || image.type || 'gallery');
        if (!VALID_IMAGE_TYPES.includes(imageType)) {
            return {
                error: '유효한 image_type이 필요합니다.'
            };
        }

        const width = parseOptionalInteger(image.width, 'width');
        if (width.error) return width;

        const height = parseOptionalInteger(image.height, 'height');
        if (height.error) return height;

        const displayOrder = hasOwn(image, 'display_order')
            ? parseOptionalInteger(image.display_order, 'display_order')
            : { value: index };
        if (displayOrder.error) return displayOrder;

        const isPrimary = parseOptionalBoolean(image.is_primary, 'is_primary', index === 0);
        if (isPrimary.error) return isPrimary;

        images.push({
            image_type: imageType,
            image_url: imageUrl,
            alt_text: getTrimmedString(image.alt_text || image.alt) || null,
            caption: getTrimmedString(image.caption) || null,
            width: width.value,
            height: height.value,
            display_order: displayOrder.value,
            is_primary: isPrimary.value
        });
    }

    return {
        images
    };
};

const parseImagesPayload = (body: ProjectPayload): ProjectPayload => {
    return parseImagesArray(body.images, 'images');
};

const parseLinksArray = (value: unknown): ProjectPayload => {
    const normalized = normalizeArrayField(value, 'links');
    if (normalized.error) return normalized;

    const links = [];

    for (const [index, link] of normalized.items.entries()) {
        if (!isPlainObject(link)) {
            return {
                error: 'links 항목은 객체여야 합니다.'
            };
        }

        const url = getTrimmedString(link.url);
        if (!url) {
            return {
                error: 'link url은 필수입니다.'
            };
        }

        const linkType = getTrimmedString(link.link_type || link.type || 'other');
        if (!VALID_LINK_TYPES.includes(linkType)) {
            return {
                error: '유효한 link_type이 필요합니다.'
            };
        }

        const displayOrder = hasOwn(link, 'display_order')
            ? parseOptionalInteger(link.display_order, 'display_order')
            : { value: index };
        if (displayOrder.error) return displayOrder;

        const isPrimary = parseOptionalBoolean(link.is_primary, 'is_primary', index === 0);
        if (isPrimary.error) return isPrimary;

        links.push({
            link_type: linkType,
            label: getTrimmedString(link.label) || linkType,
            url,
            display_order: displayOrder.value,
            is_primary: isPrimary.value
        });
    }

    return {
        links
    };
};

const parseMetricsArray = (value: unknown): ProjectPayload => {
    const normalized = normalizeArrayField(value, 'metrics');
    if (normalized.error) return normalized;

    const metrics = [];

    for (const [index, metric] of normalized.items.entries()) {
        if (!isPlainObject(metric)) {
            return {
                error: 'metrics 항목은 객체여야 합니다.'
            };
        }

        const label = getTrimmedString(metric.label);
        const metricValue = getTrimmedString(metric.value);
        if (!label || !metricValue) {
            return {
                error: 'metric label과 value는 필수입니다.'
            };
        }

        const displayOrder = hasOwn(metric, 'display_order')
            ? parseOptionalInteger(metric.display_order, 'display_order')
            : { value: index };
        if (displayOrder.error) return displayOrder;

        const isHighlighted = parseOptionalBoolean(metric.is_highlighted, 'is_highlighted', false);
        if (isHighlighted.error) return isHighlighted;

        metrics.push({
            metric_group: getTrimmedString(metric.metric_group || metric.group) || 'spec',
            label,
            value: metricValue,
            unit: getTrimmedString(metric.unit) || null,
            description: getTrimmedString(metric.description) || null,
            display_order: displayOrder.value,
            is_highlighted: isHighlighted.value
        });
    }

    return {
        metrics
    };
};

const normalizeSkillName = (skill: unknown): string => {
    if (typeof skill === 'string') {
        return skill.trim();
    }

    if (isPlainObject(skill)) {
        return getTrimmedString(skill.name || skill.label);
    }

    return '';
};

const parseSkillsArray = (value: unknown): ProjectPayload => {
    const skillItems = Array.isArray(value)
        ? value
        : (typeof value === 'string' ? value.split(',') : null);

    if (!skillItems) {
        return {
            error: 'skills 배열이 필요합니다.'
        };
    }

    const seenNames = new Set();
    const skills = [];

    for (const [index, skill] of skillItems.entries()) {
        const name = normalizeSkillName(skill);
        if (!name) {
            return {
                error: 'skill name은 필수입니다.'
            };
        }

        const duplicateKey = name.toLowerCase();
        if (seenNames.has(duplicateKey)) {
            return {
                error: 'skills에 동일한 기술을 중복 입력할 수 없습니다.'
            };
        }
        seenNames.add(duplicateKey);

        if (isPlainObject(skill)) {
            const importance = getTrimmedString(skill.importance || 'secondary');
            if (!VALID_SKILL_IMPORTANCE.includes(importance)) {
                return {
                    error: '유효한 skill importance가 필요합니다.'
                };
            }

            const displayOrder = hasOwn(skill, 'display_order')
                ? parseOptionalInteger(skill.display_order, 'display_order')
                : { value: index };
            if (displayOrder.error) return displayOrder;

            skills.push({
                name,
                importance,
                display_order: displayOrder.value
            });
        } else {
            skills.push(name);
        }
    }

    return {
        skills
    };
};

const getSectionDuplicateKey = (section: ProjectPayload): string => (
    section.id ? `id:${section.id}` : `slug:${section.slug}`
);

const parseSectionsArray = (value: unknown): ProjectPayload => {
    const normalized = normalizeArrayField(value, 'sections');
    if (normalized.error) return normalized;

    const seenSections = new Set();
    const sections = [];

    for (const [index, section] of normalized.items.entries()) {
        const sectionData: ProjectPayload = typeof section === 'string'
            ? { slug: section.trim() }
            : section;

        if (!isPlainObject(sectionData)) {
            return {
                error: 'sections 항목은 객체 또는 slug 문자열이어야 합니다.'
            };
        }

        const rawId = sectionData.id;
        const rawSlug = getTrimmedString(sectionData.slug);
        const normalizedSection: ProjectPayload = {};

        if (rawId !== undefined && rawId !== null && rawId !== '') {
            const parsedId = parseOptionalInteger(rawId, 'section id');
            if (parsedId.error || !parsedId.value) {
                return {
                    error: '유효한 section id가 필요합니다.'
                };
            }
            normalizedSection.id = parsedId.value;
        } else if (rawSlug) {
            if (!isValidSlug(rawSlug)) {
                return {
                    error: '유효한 section slug가 필요합니다.'
                };
            }
            normalizedSection.slug = rawSlug;
        } else {
            return {
                error: 'section id 또는 slug가 필요합니다.'
            };
        }

        const duplicateKey = getSectionDuplicateKey(normalizedSection);
        if (seenSections.has(duplicateKey)) {
            return {
                error: 'sections에 동일한 섹션을 중복 입력할 수 없습니다.'
            };
        }
        seenSections.add(duplicateKey);

        const displayOrder = hasOwn(sectionData, 'display_order')
            ? parseOptionalInteger(sectionData.display_order, 'display_order')
            : { value: index };
        if (displayOrder.error) return displayOrder;

        normalizedSection.display_order = displayOrder.value;
        normalizedSection.custom_label = getTrimmedString(sectionData.custom_label) || null;
        normalizedSection.custom_summary = getTrimmedString(sectionData.custom_summary) || null;
        sections.push(normalizedSection);
    }

    return {
        sections
    };
};

const validateProjectRelationsPayload = (data: ProjectPayload): ProjectPayload => {
    const payload = { ...data };

    if (hasOwn(payload, 'images')) {
        const parsed = parseImagesArray(payload.images, 'images');
        if (parsed.error) return parsed;
        payload.images = parsed.images;
    }

    if (hasOwn(payload, 'media')) {
        const parsed = parseImagesArray(payload.media, 'media');
        if (parsed.error) return parsed;
        payload.media = parsed.images;
    }

    if (hasOwn(payload, 'links')) {
        const parsed = parseLinksArray(payload.links);
        if (parsed.error) return parsed;
        payload.links = parsed.links;
    }

    if (hasOwn(payload, 'metrics')) {
        const parsed = parseMetricsArray(payload.metrics);
        if (parsed.error) return parsed;
        payload.metrics = parsed.metrics;
    }

    if (hasOwn(payload, 'skills')) {
        const parsed = parseSkillsArray(payload.skills);
        if (parsed.error) return parsed;
        payload.skills = parsed.skills;
    }

    if (hasOwn(payload, 'sections')) {
        const parsed = parseSectionsArray(payload.sections);
        if (parsed.error) return parsed;
        payload.sections = parsed.sections;
    }

    return {
        payload
    };
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
    parseImagesPayload,
    validateProjectRelationsPayload,
    trimDeep
};

export {};
