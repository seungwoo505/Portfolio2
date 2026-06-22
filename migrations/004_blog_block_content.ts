const columnExists = async (connection, tableName, columnName) => {
    const [rows] = await connection.execute(
        `
            SELECT COLUMN_NAME
            FROM INFORMATION_SCHEMA.COLUMNS
            WHERE TABLE_SCHEMA = DATABASE()
              AND TABLE_NAME = ?
              AND COLUMN_NAME = ?
            LIMIT 1
        `,
        [tableName, columnName]
    );

    return rows.length > 0;
};

const addColumnIfMissing = async (connection, tableName, columnName, definition) => {
    if (await columnExists(connection, tableName, columnName)) {
        return;
    }

    await connection.execute(`ALTER TABLE ${tableName} ADD COLUMN ${columnName} ${definition}`);
};

module.exports = {
    async up(connection, logger) {
        await addColumnIfMissing(connection, 'blog_posts', 'content_json', 'LONGTEXT NULL AFTER content');
        await addColumnIfMissing(connection, 'blog_posts', 'content_html', 'LONGTEXT NULL AFTER content_json');
        await addColumnIfMissing(connection, 'blog_posts', 'content_text', 'LONGTEXT NULL AFTER content_html');

        logger.info('블로그 블록 콘텐츠 컬럼 확인 완료');
    }
};
export {};
