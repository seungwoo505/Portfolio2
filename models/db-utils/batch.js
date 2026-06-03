const logger = require('../../log');
const { executeQuery } = require('./execution');

const executeBatch = async (queries) => {
    const start = Date.now();
    const results = [];

    try {
        for (const { query, params = [], options = {} } of queries) {
            const result = await executeQuery(query, params, options);
            results.push(result);
        }

        const duration = Date.now() - start;
        logger.database('배치 쿼리 실행 완료', {
            duration: `${duration}ms`,
            queryCount: queries.length
        });

        return results;
    } catch (error) {
        const duration = Date.now() - start;
        logger.error('배치 쿼리 실행 실패', {
            error: error.message,
            duration: `${duration}ms`,
            queryCount: queries.length
        });
        throw error;
    }
};

module.exports = {
    executeBatch
};
