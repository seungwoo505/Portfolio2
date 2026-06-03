const { AI_ROUTE_TIMEOUT } = require('./config');

const withTimeout = async (promise, label) => {
    let timeoutId;

    const timeout = new Promise((_, reject) => {
        timeoutId = setTimeout(() => {
            const error = new Error(`${label} 요청 시간이 초과되었습니다.`);
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
