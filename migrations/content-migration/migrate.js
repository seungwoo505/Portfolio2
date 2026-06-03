const logger = require('../../log');
const { getSourceColumns, getTargetColumns, insertRows, selectRows } = require('./rows');

const migrateTable = async (sourcePool, targetPool, plan) => {
    const [sourceColumns, targetColumns] = await Promise.all([
        getSourceColumns(sourcePool, plan.source),
        getTargetColumns(targetPool, plan.target)
    ]);
    const rows = await selectRows(sourcePool, plan, sourceColumns);
    const migrated = await insertRows(targetPool, plan, targetColumns, rows);

    logger.info('콘텐츠 테이블 이전 완료', {
        source: plan.source,
        target: plan.target,
        migrated
    });
};

const recalculateTagUsage = async (targetPool) => {
    await targetPool.execute(`
        UPDATE tags t
        LEFT JOIN (
            SELECT tag_id, COUNT(*) AS cnt
            FROM tag_usage
            GROUP BY tag_id
        ) u ON t.id = u.tag_id
        SET t.usage_count = COALESCE(u.cnt, 0)
    `);
};

module.exports = {
    migrateTable,
    recalculateTagUsage
};
