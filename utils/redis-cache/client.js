const redis = require('redis');
const logger = require('../../log');

const createRedisClient = ({ onConnect, onError, onEnd } = {}) => {
    const socketPath = process.env.REDIS_SOCKET || '/run/synocached.sock';
    const redisConfig = {
        socket: {
            path: socketPath,
            reconnectStrategy: (retries, cause) => {
                if (cause?.code === 'ECONNREFUSED') {
                    logger.warn('Redis Unix 소켓 연결 실패, 메모리 캐시를 사용합니다.');
                    return false;
                }
                if (retries > 10) {
                    return false;
                }
                return Math.min(retries * 100, 3000);
            }
        }
    };

    logger.info('Redis Unix 소켓 연결 시도', { socketPath });

    const client = redis.createClient(redisConfig);

    client.on('connect', () => {
        logger.info('Redis Unix 소켓 연결 성공');
        onConnect?.();
    });

    client.on('error', (err) => {
        logger.warn('Redis Unix 소켓 연결 오류', { error: err.message });
        onError?.(err);
    });

    client.on('end', () => {
        logger.warn('Redis Unix 소켓 연결 종료');
        onEnd?.();
    });

    return client;
};

module.exports = {
    createRedisClient
};
