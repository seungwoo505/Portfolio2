const buildHealthResponse = ({ now = new Date(), uptimeSeconds = process.uptime() } = {}) => ({
    status: 'healthy',
    timestamp: now.toISOString(),
    uptime: `${Math.floor(uptimeSeconds)}s`
});

module.exports = {
    buildHealthResponse
};
