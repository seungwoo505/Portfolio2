type HealthResponseOptions = {
    now?: Date;
    uptimeSeconds?: number;
};

const buildHealthResponse = ({
    now = new Date(),
    uptimeSeconds = process.uptime()
}: HealthResponseOptions = {}) => ({
    status: 'healthy',
    timestamp: now.toISOString(),
    uptime: `${Math.floor(uptimeSeconds)}s`
});

module.exports = {
    buildHealthResponse
};

export {};
