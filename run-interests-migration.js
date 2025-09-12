const mysql = require('mysql2/promise');
const fs = require('fs');
const path = require('path');
const logger = require('./log');

async function runInterestsMigration() {
    let connection;
    
    try {
        // 데이터베이스 연결
        connection = await mysql.createConnection({
            host: process.env.DB_HOST || 'localhost',
            user: process.env.DB_USER || 'root',
            password: process.env.DB_PASSWORD || '',
            database: process.env.DB_SCHEMA || 'portfolio_db'
        });

        logger.debug('✅ 데이터베이스 연결 성공');

        // 1. interests 테이블 생성 마이그레이션
        logger.debug('📖 interests 테이블 생성 마이그레이션 시작...');
        const interestsMigrationPath = path.join(__dirname, 'migrations', 'create-interests-table.sql');
        const interestsMigrationSQL = fs.readFileSync(interestsMigrationPath, 'utf8');

        const interestsStatements = interestsMigrationSQL
            .split(';')
            .map(stmt => stmt.trim())
            .filter(stmt => stmt.length > 0 && !stmt.startsWith('--'));

        for (const statement of interestsStatements) {
            if (statement.trim()) {
                logger.debug(`🚀 실행 중: ${statement.substring(0, 50)}...`);
                await connection.execute(statement);
            }
        }

        logger.debug('✅ interests 테이블 생성 완료!');

        // 2. personal_info 테이블 수정 마이그레이션
        logger.debug('📖 personal_info 테이블 수정 마이그레이션 시작...');
        const personalInfoMigrationPath = path.join(__dirname, 'migrations', 'add-about-and-social-fields-to-personal-info.sql');
        const personalInfoMigrationSQL = fs.readFileSync(personalInfoMigrationPath, 'utf8');

        const personalInfoStatements = personalInfoMigrationSQL
            .split(';')
            .map(stmt => stmt.trim())
            .filter(stmt => stmt.length > 0 && !stmt.startsWith('--'));

        for (const statement of personalInfoStatements) {
            if (statement.trim()) {
                logger.debug(`🚀 실행 중: ${statement.substring(0, 50)}...`);
                await connection.execute(statement);
            }
        }

        logger.debug('✅ personal_info 테이블 수정 완료!');

        // 3. 결과 확인
        logger.debug('🔍 마이그레이션 결과 확인...');
        
        // interests 테이블 확인
        const [interestsRows] = await connection.execute('SELECT COUNT(*) as count FROM interests');
        logger.debug(`📊 interests 테이블: ${interestsRows[0].count}개 레코드`);

        // personal_info 테이블 구조 확인
        const [personalInfoColumns] = await connection.execute('DESCRIBE personal_info');
        const newColumns = personalInfoColumns.filter(col => 
            ['about', 'github_url', 'linkedin_url', 'twitter_url', 'instagram_url'].includes(col.Field)
        );
        logger.debug(`📊 personal_info 테이블에 추가된 컬럼: ${newColumns.map(col => col.Field).join(', ')}`);

        logger.debug('🎉 모든 마이그레이션이 성공적으로 완료되었습니다!');

    } catch (error) {
        logger.error('❌ 마이그레이션 실패:', error);
        process.exit(1);
    } finally {
        if (connection) {
            await connection.end();
            logger.debug('🔌 데이터베이스 연결 종료');
        }
    }
}

// 마이그레이션 실행
runInterestsMigration();
