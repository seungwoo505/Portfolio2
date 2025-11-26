const mysql = require('mysql2/promise');
const fs = require('fs');
const path = require('path');
const logger = require('./log');

async function testInterestsAPI() {
    let connection;
    
    try {
        connection = await mysql.createConnection({
            host: process.env.DB_HOST || 'localhost',
            user: process.env.DB_USER || 'root',
            password: process.env.DB_PASSWORD || '',
            database: process.env.DB_SCHEMA || 'portfolio_db'
        });

        logger.info('데이터베이스 연결 성공');

        logger.info('interests 테이블 존재 여부 확인...');
        try {
            const [tables] = await connection.execute("SHOW TABLES LIKE 'interests'");
            if (tables.length === 0) {
                logger.info('interests 테이블이 존재하지 않습니다. 마이그레이션을 실행해주세요.');
                return;
            }
            logger.info('interests 테이블이 존재합니다.');
        } catch (error) {
            logger.info('interests 테이블 확인 실패:', error.message);
            return;
        }

        logger.info('interests 테이블 구조 확인...');
        const [columns] = await connection.execute('DESCRIBE interests');
        logger.info('interests 테이블 컬럼:');
        columns.forEach(col => {
            logger.info(`  - ${col.Field}: ${col.Type} ${col.Null === 'NO' ? '(NOT NULL)' : ''}`);
        });

        logger.info('interests 데이터 확인...');
        const [interests] = await connection.execute('SELECT * FROM interests ORDER BY category, display_order');
        logger.info(`총 ${interests.length}개의 관심사 데이터:`);
        interests.forEach(interest => {
            logger.info(`  - [${interest.category}] ${interest.title} (${interest.icon})`);
        });

        logger.info('personal_info 테이블 새 컬럼 확인...');
        const [personalInfoColumns] = await connection.execute('DESCRIBE personal_info');
        const newColumns = personalInfoColumns.filter(col => 
            ['about', 'github_url', 'linkedin_url', 'twitter_url', 'instagram_url'].includes(col.Field)
        );
        
        if (newColumns.length > 0) {
            logger.info('personal_info 테이블에 새 컬럼들이 추가되었습니다:');
            newColumns.forEach(col => {
                logger.info(`  - ${col.Field}: ${col.Type}`);
            });
        } else {
            logger.info('personal_info 테이블에 새 컬럼들이 없습니다. 마이그레이션을 실행해주세요.');
        }

        logger.info('API 응답 시뮬레이션...');
        
        const allInterests = await connection.execute('SELECT * FROM interests ORDER BY category, display_order');
        logger.info('GET /interests 응답:');
        logger.info(JSON.stringify({
            success: true,
            data: allInterests[0]
        }, null, 2));

        const technicalInterests = await connection.execute('SELECT * FROM interests WHERE category = "technical" ORDER BY display_order');
        logger.info('GET /interests?category=technical 응답:');
        logger.info(JSON.stringify({
            success: true,
            data: technicalInterests[0]
        }, null, 2));

        const personalInterests = await connection.execute('SELECT * FROM interests WHERE category = "personal" ORDER BY display_order');
        logger.info('GET /interests?category=personal 응답:');
        logger.info(JSON.stringify({
            success: true,
            data: personalInterests[0]
        }, null, 2));

        logger.info('API 테스트 완료!');

    } catch (error) {
        logger.error('API 테스트 실패:', error);
    } finally {
        if (connection) {
            await connection.end();
            logger.info('데이터베이스 연결 종료');
        }
    }
}

testInterestsAPI();
