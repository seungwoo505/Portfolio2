require('dotenv').config({ quiet: true });

const logger = require('../../log');
const { createPool } = require('./db');
const { migrateTable, recalculateTagUsage } = require('./migrate');
const { tablePlans } = require('./plans');

async function run() {
    const sourceSchema = process.env.SOURCE_DB_SCHEMA;
    const targetSchema = process.env.TARGET_DB_SCHEMA || process.env.DB_SCHEMA;

    if (!sourceSchema || !targetSchema) {
        throw new Error('SOURCE_DB_SCHEMA와 TARGET_DB_SCHEMA 또는 DB_SCHEMA 환경 변수가 필요합니다.');
    }

    if (sourceSchema === targetSchema) {
        throw new Error('콘텐츠 이전은 SOURCE_DB_SCHEMA와 TARGET_DB_SCHEMA가 서로 달라야 합니다.');
    }

    const sourcePool = createPool(sourceSchema);
    const targetPool = createPool(targetSchema);

    try {
        await targetPool.execute('SET FOREIGN_KEY_CHECKS = 0');
        for (const plan of tablePlans) {
            await migrateTable(sourcePool, targetPool, plan);
        }
        await recalculateTagUsage(targetPool);
        await targetPool.execute('SET FOREIGN_KEY_CHECKS = 1');
        logger.info('콘텐츠 이전이 완료되었습니다.', { sourceSchema, targetSchema });
    } catch (error) {
        await targetPool.execute('SET FOREIGN_KEY_CHECKS = 1');
        throw error;
    } finally {
        await sourcePool.end();
        await targetPool.end();
    }
}

const runCli = () => {
    run().catch((error) => {
        logger.error('콘텐츠 이전 실패', { error: error.message, stack: error.stack });
        process.exit(1);
    });
};

module.exports = {
    run,
    runCli
};
