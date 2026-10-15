import type { ParsedQs } from 'qs';

const { parsePagination } = require('../../../utils/pagination');
const { toOptionalBoolean, toCsvStringArray, toStringArray, toStringValue } = require('../../../utils/filter-values');

const buildProjectFilters = (query: ParsedQs) => {
    const featured = toOptionalBoolean(query.featured);
    if (!featured.isValid) {
        return {
            error: 'featured 값은 boolean이어야 합니다.'
        };
    }

    const { limit, page, offset } = parsePagination(query, {
        defaultLimit: 10,
        maxLimit: 50
    });

    // 명시 배열과 반복 키는 각 기술명을 보존하고 단일 문자열은 기존 CSV 계약을 유지한다.
    const skills = query['skills[]'] !== undefined
        ? toStringArray(query['skills[]'])
        : Array.isArray(query.skills)
            ? toStringArray(query.skills)
            : toCsvStringArray(query.skills);

    return {
        limit,
        page,
        offset,
        search: toStringValue(query.search),
        tags: toCsvStringArray(query.tags),
        skills,
        featured: featured.value,
        status: 'published',
        sort: toStringValue(query.sort, 'display_order'),
        order: toStringValue(query.order, 'asc'),
        published_only: true
    };
};

const buildPostFilters = (query: ParsedQs) => {
    const featured = toOptionalBoolean(query.featured);
    if (!featured.isValid) {
        return {
            error: 'featured 값은 boolean이어야 합니다.'
        };
    }

    const { limit, page, offset } = parsePagination(query, {
        defaultLimit: 10,
        maxLimit: 50
    });

    return {
        limit,
        page,
        offset,
        search: toStringValue(query.search),
        tags: toCsvStringArray(query.tags),
        featured: featured.value,
        status: 'published',
        sort: toStringValue(query.sort, 'published_at'),
        order: toStringValue(query.order, 'desc'),
        published_only: true
    };
};

module.exports = {
    buildPostFilters,
    buildProjectFilters,
    parsePagination,
    toOptionalBoolean,
    toStringValue
};
