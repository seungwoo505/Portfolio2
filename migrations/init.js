const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');
const logger = require('../log');

const migrationsDir = __dirname;

const createConnection = () => mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    port: Number(process.env.DB_PORT || 3306),
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_SCHEMA || 'portfolio_db',
    charset: 'utf8mb4',
    multipleStatements: false,
    timezone: 'Z'
});

const splitSqlStatements = (sql) => (
    sql
        .split(';')
        .map((statement) => statement.trim())
        .filter((statement) => statement && !statement.startsWith('--'))
);

const ensureMigrationTable = async (connection) => {
    await connection.execute(`
        CREATE TABLE IF NOT EXISTS schema_migrations (
            id INT AUTO_INCREMENT PRIMARY KEY,
            name VARCHAR(255) NOT NULL UNIQUE,
            applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
};

const isApplied = async (connection, name) => {
    const [rows] = await connection.execute(
        'SELECT id FROM schema_migrations WHERE name = ? LIMIT 1',
        [name]
    );
    return rows.length > 0;
};

const markApplied = async (connection, name) => {
    await connection.execute(
        'INSERT INTO schema_migrations (name) VALUES (?)',
        [name]
    );
};

const runSqlMigration = async (connection, filePath) => {
    const sql = fs.readFileSync(filePath, 'utf8');
    const statements = splitSqlStatements(sql);

    for (const statement of statements) {
        await connection.execute(statement);
    }
};

const runJsMigration = async (connection, filePath) => {
    const migration = require(filePath);
    if (typeof migration.up !== 'function') {
        throw new Error(`${path.basename(filePath)} 파일은 up(connection) 함수를 export해야 합니다.`);
    }
    await migration.up(connection, logger);
};

const getMigrationFiles = () => (
    fs.readdirSync(migrationsDir)
        .filter((name) => /^\d+_.+\.(sql|js)$/.test(name))
        .sort((a, b) => a.localeCompare(b))
);

async function runMigration() {
    const connection = await createConnection();

    try {
        await ensureMigrationTable(connection);
        const files = getMigrationFiles();

        for (const fileName of files) {
            if (await isApplied(connection, fileName)) {
                logger.info('마이그레이션 건너뜀', { migration: fileName });
                continue;
            }

            const filePath = path.join(migrationsDir, fileName);
            logger.info('마이그레이션 적용 시작', { migration: fileName });

            if (fileName.endsWith('.sql')) {
                await runSqlMigration(connection, filePath);
            } else {
                await runJsMigration(connection, filePath);
            }

            await markApplied(connection, fileName);
            logger.info('마이그레이션 적용 완료', { migration: fileName });
        }
    } finally {
        await connection.end();
    }
}

module.exports = {
    runMigration
};
