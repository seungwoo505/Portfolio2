import type { Request } from 'express';

type HeaderValue = string | string[] | undefined;

type AdminTokenPayload = {
    id: number | string;
    username?: string;
    role?: string;
    sid?: string;
};

type AdminUserContext = {
    id?: number | string;
    username?: string;
    role?: string;
};

const firstHeaderValue = (value: HeaderValue): string | undefined => (
    Array.isArray(value) ? value[0] : value
);

const getClientIp = (req: Request): string | undefined => req.ip || req.connection.remoteAddress;

const buildAdminContext = ({
    decoded,
    user = null
}: {
    decoded: AdminTokenPayload;
    user?: AdminUserContext | null;
}) => ({
    id: user?.id ?? decoded.id,
    username: user?.username ?? decoded.username,
    role: user?.role ?? decoded.role,
    sessionId: decoded.sid
});

const extractAuthTokens = (req: Request) => {
    const authHeader = firstHeaderValue(req.headers['authorization']);
    return {
        token: authHeader && authHeader.split(' ')[1],
        refreshToken: firstHeaderValue(req.headers['x-refresh-token'])
    };
};

module.exports = {
    buildAdminContext,
    extractAuthTokens,
    getClientIp
};

export {};
