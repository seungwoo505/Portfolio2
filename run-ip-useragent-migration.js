const mysql = require('mysql2/promise');
const fs = require('fs');
const path = require('path');
const logger = require('./log');

async function runIpUserAgentMigration() {
    let connection;
    
    try {
        connection = await mysql.createConnection({
            host: process.env.DB_HOST || 'localhost',
            user: process.env.DB_USER || 'root',
            password: process.env.DB_PASSWORD || '',
            database: process.env.DB_SCHEMA || 'portfolio_db'
        });

        logger.info('✅ 데이터베이스 연결 성공');

        const migrationSQL = fs.readFileSync(path.join(__dirname, 'add-ip-useragent.sql'), 'utf8');

        logger.info('📖 마이그레이션 SQL 준비 완료');

        const statements = migrationSQL
            .split(';')
            .map(stmt => stmt.trim())
            .filter(stmt => stmt.length > 0 && !stmt.startsWith('--'));

        logger.info(`🚀 ${statements.length}개의 SQL 문장 실행 중...`);

        for (let i = 0; i < statements.length; i++) {
            const statement = statements[i];
            if (statement.trim()) {
                logger.info(`📝 실행 중: ${statement.substring(0, 50)}...`);
                await connection.execute(statement);
                logger.info(`✅ 문장 ${i + 1}/${statements.length} 완료`);
            }
        }

        logger.info('✅ 마이그레이션 완료!');
        logger.info('🎯 contact_messages 테이블에 ip_address, user_agent 컬럼이 추가되었습니다.');

        logger.info('🔍 테이블 구조 확인 중...');
        const [columns] = await connection.execute('DESCRIBE contact_messages');
        
        const ipAddressColumn = columns.find(col => col.Field === 'ip_address');
        const userAgentColumn = columns.find(col => col.Field === 'user_agent');
        
        if (ipAddressColumn) {
            logger.info('✅ ip_address 컬럼 확인됨:', ipAddressColumn);
        } else {
            logger.error('❌ ip_address 컬럼을 찾을 수 없습니다.');
        }

        if (userAgentColumn) {
            logger.info('✅ user_agent 컬럼 확인됨:', userAgentColumn);
        } else {
            logger.error('❌ user_agent 컬럼을 찾을 수 없습니다.');
        }

        logger.info('🔍 인덱스 확인 중...');
        const [indexes] = await connection.execute('SHOW INDEX FROM contact_messages');
        const ipIndex = indexes.find(idx => idx.Key_name === 'idx_contact_messages_ip_address');
        const createdAtIndex = indexes.find(idx => idx.Key_name === 'idx_contact_messages_created_at');
        
        if (ipIndex) {
            logger.info('✅ ip_address 인덱스 확인됨');
        }
        if (createdAtIndex) {
            logger.info('✅ created_at 인덱스 확인됨');
        }

    } catch (error) {
        logger.error('❌ 마이그레이션 실패:', error);
        
        if (error.code === 'ER_DUP_FIELDNAME') {
            logger.warn('⚠️ 이미 컬럼이 존재합니다. 마이그레이션이 이미 실행되었을 수 있습니다.');
        } else if (error.code === 'ER_DUP_KEYNAME') {
            logger.warn('⚠️ 이미 인덱스가 존재합니다. 마이그레이션이 이미 실행되었을 수 있습니다.');
        }
        
        throw error;
    } finally {
        if (connection) {
            await connection.end();
            logger.info('🔌 데이터베이스 연결 종료');
        }
    }
}

if (require.main === module) {
    runIpUserAgentMigration()
        .then(() => {
            logger.info('🎉 마이그레이션이 성공적으로 완료되었습니다!');
            process.exit(0);
        })
        .catch((error) => {
            logger.error('💥 마이그레이션 실패:', error);
            process.exit(1);
        });
}

module.exports = runIpUserAgentMigration;

