import type { Request } from 'express';

const { logger } = require('../common');
const { getActionLabel, getResourceLabel } = require('./labels');

const buildActivityDetails = (
    action: string,
    req: Request,
    resourceType: string,
    resourceId: unknown
): string => {
    const resourceLabel = getResourceLabel(resourceType);
    const label = getActionLabel(action);
    const safeBody = logger.redact(req.body || {}) as Record<string, unknown>;
    const changedFields = ['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method)
        ? Object.keys(safeBody).filter((key) => safeBody[key] !== undefined)
        : [];

    const targetName = safeBody.title || safeBody.name || safeBody.username || safeBody.platform;
    const target = targetName || (resourceId ? `#${resourceId}` : '');
    const fieldText = changedFields.length > 0 ? ` 변경 필드: ${changedFields.join(', ')}` : '';

    return `${resourceLabel} ${label}${target ? `: ${target}` : ''}${fieldText}`;
};

module.exports = {
    buildActivityDetails
};
