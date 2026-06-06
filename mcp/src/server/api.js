const DEFAULT_API_BASE_URL = 'http://localhost:3333/api';

async function apiGet(path, query = {}) {
    if (typeof fetch !== 'function') {
        throw new Error('Node.js 18 이상이 필요합니다. 현재 런타임에는 fetch가 없습니다.');
    }

    const apiBaseUrl = (process.env.PORTFOLIO_API_BASE_URL || DEFAULT_API_BASE_URL).replace(/\/+$/, '');
    const url = new URL(`${apiBaseUrl}${path}`);

    Object.entries(query).forEach(([key, value]) => {
        if (value !== undefined && value !== null && value !== '') {
            url.searchParams.set(key, String(value));
        }
    });

    const response = await fetch(url, {
        headers: {
            accept: 'application/json'
        }
    });
    const payload = await response.json().catch(() => null);

    if (!response.ok) {
        const message = payload?.message || payload?.error || `${response.status} ${response.statusText}`;
        throw new Error(`Portfolio API request failed: ${message}`);
    }

    if (payload && payload.success === false) {
        throw new Error(payload.message || payload.error || 'Portfolio API returned success=false');
    }

    return payload;
}

function normalizeListArgs(args = {}, arrayFields = []) {
    const query = pickDefined({
        limit: clampInteger(args.limit, 1, 50),
        page: clampInteger(args.page, 1, Number.MAX_SAFE_INTEGER),
        search: args.search,
        featured: typeof args.featured === 'boolean' ? args.featured : undefined,
        sort: args.sort,
        order: args.order
    });

    arrayFields.forEach((field) => {
        if (Array.isArray(args[field]) && args[field].length > 0) {
            query[field] = args[field].map((value) => String(value).trim()).filter(Boolean).join(',');
        }
    });

    return query;
}

function pickDefined(object) {
    return Object.fromEntries(
        Object.entries(object).filter(([, value]) => value !== undefined && value !== null && value !== '')
    );
}

function clampInteger(value, min, max) {
    if (value === undefined || value === null) {
        return undefined;
    }

    let parsed;
    if (typeof value === 'number') {
        parsed = value;
    } else if (typeof value === 'string') {
        const normalizedValue = value.trim();
        if (!/^-?\d+$/.test(normalizedValue)) {
            return undefined;
        }
        parsed = Number(normalizedValue);
    } else {
        return undefined;
    }

    if (!Number.isSafeInteger(parsed)) {
        return undefined;
    }
    return Math.min(Math.max(parsed, min), max);
}

function requireString(args, key) {
    const value = args?.[key];
    if (typeof value !== 'string' || value.trim() === '') {
        throw new Error(`${key} is required`);
    }
    return value.trim();
}

module.exports = {
    apiGet,
    normalizeListArgs,
    pickDefined,
    requireString
};
