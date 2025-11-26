#!/usr/bin/env node

/**
 * 데이터베이스 초기 설정 스크립트
 * 이 스크립트는 데이터베이스 테이블을 생성하고 초기 데이터를 삽입합니다.
 */

require('dotenv').config();
const { runMigration } = require('./migrations/init');
const logger = require('./log');

logger.info('포트폴리오 데이터베이스 설정을 시작합니다...');
logger.info(` 데이터베이스: ${process.env.DB_SCHEMA}`);
logger.info(`  호스트: ${process.env.DB_HOST}:${process.env.DB_PORT}`);
logger.info(` 사용자: ${process.env.DB_USER}`);
logger.info('');

runMigration().catch((error) => {
    logger.error('마이그레이션 실행 실패', { error: error.message, stack: error.stack });
    process.exit(1);
});
