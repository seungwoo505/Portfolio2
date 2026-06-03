const getClientIp = (req) => {
    const ip = req.ip || req.connection.remoteAddress || null;
    return ip && ip.startsWith('::ffff:') ? ip.substring(7) : ip;
};

const summarizeUserAgent = (userAgent = '') => {
    if (!userAgent) {
        return null;
    }

    const os = userAgent.includes('Windows') ? 'Windows'
        : userAgent.includes('Macintosh') || userAgent.includes('Mac OS X') ? 'macOS'
            : userAgent.includes('Android') ? 'Android'
                : userAgent.includes('iPhone') || userAgent.includes('iPad') ? 'iOS'
                    : userAgent.includes('Linux') ? 'Linux'
                        : 'Unknown';

    const browser = userAgent.includes('Edg/') ? 'Edge'
        : userAgent.includes('Chrome') ? 'Chrome'
            : userAgent.includes('Firefox') ? 'Firefox'
                : userAgent.includes('Safari') ? 'Safari'
                    : 'Unknown';

    return `${os} | ${browser}`;
};

const inferResourceType = (req) => {
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

const getResourceId = (req) => (
    req.params.id ||
    req.params.slug ||
    req.params.postId ||
    req.params.projectId ||
    req.body?.id ||
    null
);

module.exports = {
    getClientIp,
    getResourceId,
    inferResourceType,
    summarizeUserAgent
};
