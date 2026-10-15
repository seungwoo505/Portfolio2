import type { Request } from 'express';

const getClientIp = (req: Request): string | null => {
    const ip = req.ip || req.connection.remoteAddress || null;
    return ip && ip.startsWith('::ffff:') ? ip.substring(7) : ip;
};

const summarizeUserAgent = (userAgent = ''): string | null => {
    if (!userAgent) {
        return null;
    }

    const os = userAgent.includes('Windows') ? 'Windows'
        : userAgent.includes('iPhone') || userAgent.includes('iPad') ? 'iOS'
            : userAgent.includes('Macintosh') || userAgent.includes('Mac OS X') ? 'macOS'
                : userAgent.includes('Android') ? 'Android'
                    : userAgent.includes('Linux') ? 'Linux'
                        : 'Unknown';

    const browser = userAgent.includes('Edg/') ? 'Edge'
        : userAgent.includes('Chrome') ? 'Chrome'
            : userAgent.includes('Firefox') ? 'Firefox'
                : userAgent.includes('Safari') ? 'Safari'
                    : 'Unknown';

    return `${os} | ${browser}`;
};

const inferResourceType = (req: Request): string => {
    const pathSegments = String(req.originalUrl || '')
        .split('?')[0]
        .split('/')
        .filter(Boolean);
    const apiIndex = pathSegments.indexOf('api');
    const apiPath = apiIndex >= 0 ? pathSegments.slice(apiIndex + 1) : pathSegments;

    if (apiPath[0] === 'admin' && apiPath[1]) {
        return apiPath[1];
    }
    if (apiPath[0]) {
        return apiPath[0];
    }

    return req.baseUrl.split('/').pop() || 'unknown';
};

const getResourceId = (req: Request, responseData?: unknown): unknown => {
    if (responseData !== null && typeof responseData === 'object' && 'id' in responseData) {
        const id = responseData.id;
        if (typeof id === 'number' || typeof id === 'string') return id;
    }

    return req.params.id || req.params.slug || req.params.postId || req.params.projectId || null;
};

module.exports = {
    getClientIp,
    getResourceId,
    inferResourceType,
    summarizeUserAgent
};
