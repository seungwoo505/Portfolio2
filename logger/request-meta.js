const adminFromRequest = (req) => {
    if (!req?.admin) {
        return null;
    }

    return {
        id: req.admin.id,
        username: req.admin.username,
        role: req.admin.role
    };
};

const requestMeta = (req, extra = {}) => ({
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
