const mysql = require('mysql2/promise');
const fs = require('fs');
const path = require('path');
const logger = require('./log');

async function runProjectMigration() {
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

        // 마이그레이션 SQL 직접 실행
        const migrationSQL = `
            ALTER TABLE projects 
            ADD COLUMN is_published BOOLEAN DEFAULT FALSE AFTER is_featured;
        `;

        logger.debug('📖 마이그레이션 SQL 준비 완료');

        // SQL 실행
        logger.debug('🚀 is_published 필드 추가 중...');
        await connection.execute(migrationSQL);

        logger.debug('✅ 마이그레이션 완료!');
        logger.debug('🎯 이제 is_published 필드가 projects 테이블에 추가되었습니다.');

        // 테이블 구조 확인
        logger.debug('🔍 테이블 구조 확인 중...');
        const [columns] = await connection.execute('DESCRIBE projects');
        const isPublishedColumn = columns.find(col => col.Field === 'is_published');
        
        if (isPublishedColumn) {
            logger.debug('✅ is_published 컬럼 확인됨:', isPublishedColumn);
        } else {
            logger.debug('❌ is_published 컬럼을 찾을 수 없습니다.');
        }

    } catch (error) {
        logger.error('❌ 마이그레이션 실패:', error);
        
        // 이미 컬럼이 존재하는 경우 처리
        if (error.code === 'ER_DUP_FIELDNAME') {
            logger.debug('ℹ️ is_published 컬럼이 이미 존재합니다.');
            logger.debug('✅ 마이그레이션이 이미 완료되었습니다.');
        } else {
            process.exit(1);
        }
    } finally {
        if (connection) {
            await connection.end();
            logger.debug('🔌 데이터베이스 연결 종료');
        }
    }
}

// 마이그레이션 실행
runProjectMigration();
