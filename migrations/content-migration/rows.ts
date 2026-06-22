const quote = (identifier) => `\`${identifier}\``;

const getTargetColumns = async (targetPool, table) => {
    const [rows] = await targetPool.execute(`SHOW COLUMNS FROM ${quote(table)}`);
    return new Set(rows.map((row) => row.Field));
};

const getSourceColumns = async (sourcePool, table) => {
    const [rows] = await sourcePool.execute(`SHOW COLUMNS FROM ${quote(table)}`);
    return new Set(rows.map((row) => row.Field));
};

const selectRows = async (sourcePool, plan, sourceColumns) => {
    const selectedColumns = plan.columns.filter((column) => sourceColumns.has(column));
    const sql = [
        `SELECT ${selectedColumns.map(quote).join(', ')}`,
        `FROM ${quote(plan.source)}`,
        plan.where ? `WHERE ${plan.where}` : ''
    ].filter(Boolean).join(' ');

    const [rows] = await sourcePool.execute(sql);
    return rows;
};

const insertRows = async (targetPool, plan, targetColumns, rows) => {
    if (rows.length === 0) {
        return 0;
    }

    const mappedColumns = [
        ...plan.columns.filter((column) => targetColumns.has(column)),
        ...Object.keys(plan.defaults || {}).filter((column) => targetColumns.has(column))
    ];
    const placeholders = mappedColumns.map(() => '?').join(', ');
    const updateClause = mappedColumns
        .filter((column) => !['id', 'setting_key', 'project_id', 'skill_id', 'tag_id', 'content_type', 'content_id'].includes(column))
        .map((column) => `${quote(column)} = VALUES(${quote(column)})`)
        .join(', ');

    const sql = `
        INSERT INTO ${quote(plan.target)} (${mappedColumns.map(quote).join(', ')})
        VALUES (${placeholders})
        ${updateClause ? `ON DUPLICATE KEY UPDATE ${updateClause}` : ''}
    `;

    for (const row of rows) {
        const values = mappedColumns.map((column) => {
            if (Object.prototype.hasOwnProperty.call(row, column)) {
                return row[column];
            }
            return plan.defaults?.[column] ?? null;
        });
        await targetPool.execute(sql, values);
    }

    return rows.length;
};

module.exports = {
    getSourceColumns,
    getTargetColumns,
    insertRows,
    quote,
    selectRows
};
export {};
