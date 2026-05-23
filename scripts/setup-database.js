#!/usr/bin/env node

/**
 * 데이터베이스 초기 설정 스크립트
 * 이 스크립트는 데이터베이스 테이블을 생성하고 초기 데이터를 삽입합니다.
 */

require('dotenv').config();
const fs = require('fs');
const path = require('path');
const logger = require('../log');

const migrationEntry = path.join(__dirname, '..', 'migrations', 'init.js');

logger.info('포트폴리오 데이터베이스 설정을 시작합니다...');
logger.info(` 데이터베이스: ${process.env.DB_SCHEMA}`);
logger.info(`  호스트: ${process.env.DB_HOST}:${process.env.DB_PORT}`);
logger.info(` 사용자: ${process.env.DB_USER}`);
logger.info('');

if (!fs.existsSync(migrationEntry)) {
    logger.error('초기 마이그레이션 진입 파일을 찾을 수 없습니다.', {
        expectedPath: migrationEntry
    });
    logger.error('현재 저장소에는 초기 DB 스키마 마이그레이션이 포함되어 있지 않습니다. docs/README-DB.md와 SQL 마이그레이션 파일을 확인해 수동으로 적용해주세요.');
    process.exit(1);
}

const { runMigration } = require(migrationEntry);

runMigration().catch((error) => {
    logger.error('마이그레이션 실행 실패', { error: error.message, stack: error.stack });
    process.exit(1);
});
