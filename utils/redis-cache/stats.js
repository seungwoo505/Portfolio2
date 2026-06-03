const logger = require('../../log');

const getStats = async function () {
    if (!await this.ensureConnected()) {
        return { connected: false };
    }

    try {
        const info = await this.client.info('memory');
        const dbSize = await this.client.dbSize();

        return {
            connected: true,
            dbSize,
            memory: info
        };
    } catch (error) {
        logger.error('Redis 통계 조회 오류', { error: error.message });
        return { connected: false };
    }
};

module.exports = {
    getStats
};
