const { executeQuery } = require('../db-utils');

const updateUsageCounts = async () => {
    await executeQuery(`
        UPDATE tags t
        LEFT JOIN (
            SELECT tag_id, COUNT(*) AS cnt FROM project_tags GROUP BY tag_id
        ) u ON t.id = u.tag_id
        SET t.usage_count = COALESCE(u.cnt, 0)
    `);
};

module.exports = {
    updateUsageCounts
};
export {};
