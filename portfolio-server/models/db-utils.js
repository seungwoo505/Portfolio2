const db = require('../db');
const logger = require('../log');
const CacheUtils = require('../utils/cache');

/**
 * @description execute Query for Db Utils Model.
  * @param {*} query 입력값
  * @param {*} params 입력값
  * @param {*} options 입력값
 * @returns {Promise<any>} 처리 결과
 */
const executeQuery = async (query, params = [], options = {}) => {
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

        logger.debug('SQL 쿼리 실행 중', {
            query: query.replace(/\s+/g, ' ').trim(),
            params: params,
            timestamp: new Date().toISOString(),
            useCache: useCache
        });

        const [results] = await db.execute(query, params);
        const duration = Date.now() - start;
        
        if (duration > 1000) { // 1초 이상 걸리는 쿼리 경고
            logger.warn('느린 쿼리 감지', {
                duration: `${duration}ms`,
                query: query.replace(/\s+/g, ' ').trim(),
                params: params
            });
        }
        
        logger.database('쿼리 실행 성공', {
            duration: `${duration}ms`,
            rowCount: Array.isArray(results) ? results.length : (results.affectedRows || 0),
            queryType: query.trim().split(' ')[0].toUpperCase(),
            useCache: useCache
        });

        if (useCache && cacheKey && results) {
            CacheUtils.set(cacheKey, results, cacheTTL);
        }

        return results;
    } catch (error) {
        const duration = Date.now() - start;
        logger.error('데이터베이스 쿼리 실패', {
            error: error.message,
            query: query.replace(/\s+/g, ' ').trim(),
            params: params,
            duration: `${duration}ms`,
            sqlState: error.sqlState,
            errno: error.errno
        });
        throw error;
    }
};

/**
 * @description execute Query Single for Db Utils Model.
  * @param {*} query 입력값
  * @param {*} params 입력값
  * @param {*} options 입력값
 * @returns {Promise<any>} 처리 결과
 */
const executeQuerySingle = async (query, params = [], options = {}) => {
    const results = await executeQuery(query, params, options);
    return results[0] || null;
};

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

/**
 * @description execute Transaction for Db Utils Model.
  * @param {*} callback 입력값
 * @returns {Promise<any>} 처리 결과
 */
const executeTransaction = async (callback) => {
    const connection = await db.getConnection();
    
    try {
        await connection.beginTransaction();
        const result = await callback(connection);
        await connection.commit();
        return result;
    } catch (error) {
        await connection.rollback();
        throw error;
    } finally {
        connection.release();
    }
};

module.exports = {
    executeQuery,
    executeQuerySingle,
    executeBatch,
    executeTransaction
};
