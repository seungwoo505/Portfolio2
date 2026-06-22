const { AI_ROUTE_TIMEOUT } = require('./config');

type AiRouteTimeoutError = Error & {
    code?: string;
};

const withTimeout = async <T>(promise: Promise<T>, label: string): Promise<T> => {
    let timeoutId: ReturnType<typeof setTimeout>;

    const timeout = new Promise<never>((_, reject) => {
        timeoutId = setTimeout(() => {
            const error = new Error(`${label} 요청 시간이 초과되었습니다.`) as AiRouteTimeoutError;
            error.code = 'AI_ROUTE_TIMEOUT';
            reject(error);
        }, AI_ROUTE_TIMEOUT);
    });

    try {
        return await Promise.race([promise, timeout]);
    } finally {
        clearTimeout(timeoutId);
    }
};

module.exports = {
    withTimeout
};
