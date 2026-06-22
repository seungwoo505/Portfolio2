const db = require('../../db');
const logger = require('../../log');
const CacheUtils = require('../../utils/cache');
const { buildQueryLogMeta } = require('./logging');

const executeQuery = async (query, params = [], options: Record<string, any> = {}) => {
    const start = Date.now();
    const { useCache = false, cacheKey = null, cacheTTL = 300 } = options;

    try {
        if (useCache && cacheKey) {
            const cached = CacheUtils.get(cacheKey);
            if (cached !== undefined) {
                logger.debug('데이터베이스 캐시 히트', { cacheKey });
                return cached;
            }
        }

        logger.debug('SQL 쿼리 실행 중', buildQueryLogMeta(query, params, {
            timestamp: new Date().toISOString(),
            useCache
        }));

        const [results] = await db.execute(query, params);
        const duration = Date.now() - start;

        if (duration > 1000) {
            logger.warn('느린 쿼리 감지', buildQueryLogMeta(query, params, {
                duration: `${duration}ms`
            }));
        }

        logger.database('쿼리 실행 성공', {
            duration: `${duration}ms`,
            rowCount: Array.isArray(results) ? results.length : (results.affectedRows || 0),
            queryType: query.trim().split(' ')[0].toUpperCase(),
            useCache
        });

        if (useCache && cacheKey && results) {
            CacheUtils.set(cacheKey, results, cacheTTL);
        }

        return results;
    } catch (error) {
        const duration = Date.now() - start;
        logger.error('데이터베이스 쿼리 실패', buildQueryLogMeta(query, params, {
            error: error.message,
            duration: `${duration}ms`,
            sqlState: error.sqlState,
            errno: error.errno
        }));
        throw error;
    }
};

const executeQuerySingle = async (query, params = [], options = {}) => {
    const results = await executeQuery(query, params, options);
    return results[0] || null;
};

const executeConnectionQuery = async (connection, query, params = []) => {
    const [results] = await connection.execute(query, params);
    return results;
};

const executeConnectionQuerySingle = async (connection, query, params = []) => {
    const results = await executeConnectionQuery(connection, query, params);
    return results[0] || null;
};

module.exports = {
    executeConnectionQuery,
    executeConnectionQuerySingle,
    executeQuery,
    executeQuerySingle
};
export {};
