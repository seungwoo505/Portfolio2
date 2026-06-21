const logger = require('../../log');

type RedisStatsClient = {
    info: (section: string) => Promise<string>;
    dbSize: () => Promise<number>;
};

type RedisStatsContext = {
    client: RedisStatsClient;
    ensureConnected: () => Promise<boolean>;
};

type RedisStats = {
    connected: boolean;
    dbSize?: number;
    memory?: string;
};

const getErrorMessage = (error: unknown): string => (
    error instanceof Error ? error.message : String(error)
);

const getStats = async function (this: RedisStatsContext): Promise<RedisStats> {
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
        logger.error('Redis 통계 조회 오류', { error: getErrorMessage(error) });
        return { connected: false };
    }
};

module.exports = {
    getStats
};

export {};
