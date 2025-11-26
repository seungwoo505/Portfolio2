const mysql = require('mysql2/promise');
const fs = require('fs');
const path = require('path');
const logger = require('./log');

async function runMigration() {
    let connection;
    
    try {
        connection = await mysql.createConnection({
            host: process.env.DB_HOST || 'localhost',
            user: process.env.DB_USER || 'root',
            password: process.env.DB_PASSWORD || '',
            database: process.env.DB_SCHEMA || 'portfolio_db'
        });

        logger.debug('데이터베이스 연결 성공');

        const migrationPath = path.join(__dirname, 'migrations', 'add-meta-keywords.sql');
        const migrationSQL = fs.readFileSync(migrationPath, 'utf8');

        logger.debug('마이그레이션 SQL 파일 읽기 완료');

        const statements = migrationSQL
            .split(';')
            .map(stmt => stmt.trim())
            .filter(stmt => stmt.length > 0 && !stmt.startsWith('--'));

        for (const statement of statements) {
            if (statement.trim()) {
                logger.debug(`실행 중: ${statement.substring(0, 50)}...`);
                await connection.execute(statement);
            }
        }

        logger.debug('마이그레이션 완료!');
        logger.debug('이제 meta_keywords 필드가 blog_posts 테이블에 추가되었습니다.');

    } catch (error) {
        logger.error('마이그레이션 실패:', error);
        process.exit(1);
    } finally {
        if (connection) {
            await connection.end();
            logger.debug('데이터베이스 연결 종료');
        }
    }
}

runMigration();
