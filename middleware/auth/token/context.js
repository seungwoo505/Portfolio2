const getClientIp = (req) => req.ip || req.connection.remoteAddress;

const buildAdminContext = ({ decoded, user = null }) => ({
    id: user?.id ?? decoded.id,
    username: user?.username ?? decoded.username,
    role: user?.role ?? decoded.role,
    sessionId: decoded.sid
});

const extractAuthTokens = (req) => {
    const authHeader = req.headers['authorization'];
    return {
        token: authHeader && authHeader.split(' ')[1],
        refreshToken: req.headers['x-refresh-token']
    };
};

module.exports = {
    buildAdminContext,
    extractAuthTokens,
    getClientIp
};
