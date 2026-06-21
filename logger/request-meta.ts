import type { Request } from 'express';

type RequestMetaExtra = Record<string, unknown>;

const adminFromRequest = (req: Request | null | undefined) => {
    if (!req?.admin) {
        return null;
    }

    return {
        id: req.admin.id,
        username: req.admin.username,
        role: req.admin.role
    };
};

const requestMeta = (req: Request | null | undefined, extra: RequestMetaExtra = {}) => ({
    requestId: req?.requestId,
    method: req?.method,
    path: req?.originalUrl || req?.url,
    ip: req?.ip || req?.connection?.remoteAddress,
    admin: adminFromRequest(req),
    ...extra
});

module.exports = {
    adminFromRequest,
    requestMeta
};
