const mariaDB = require("mysql2/promise");
const logger = require('./log');

// 🚀 고성능 최적화된 데이터베이스 연결 풀
const db = mariaDB.createPool({
    host : process.env.DB_HOST,
    port : process.env.DB_PORT,
    user : process.env.DB_USER,
    password : process.env.DB_PASSWORD,
    database : process.env.DB_SCHEMA,
    
    // 문자셋 설정 (이모지 지원을 위해 utf8mb4 사용)
    charset: 'utf8mb4',
    
    // 연결 풀 최적화 (성능 향상)
    connectionLimit: 30, // 20 → 30으로 증가 (동시 처리 능력 향상)
    queueLimit: 0, // 대기열 제한 없음
    idleTimeout: 600000, // 5분 → 10분으로 증가 (연결 재사용율 향상)
    
    // 성능 최적화 옵션
    multipleStatements: false, // 보안을 위해 비활성화
    dateStrings: true, // 날짜를 문자열로 반환 (성능 향상)
    supportBigNumbers: true,
    bigNumberStrings: true,
    
    // 추가 성능 최적화
    compress: true, // 압축 활성화 (네트워크 트래픽 감소)
    flags: ['-FOUND_ROWS'], // FOUND_ROWS 플래그 비활성화 (성능 향상)
    
    // SSL 설정 (같은 호스트이므로 비활성화)
    ssl: false,
    
    // 연결 풀 모니터링
    enableKeepAlive: true,
    keepAliveInitialDelay: 0,
    
    // 쿼리 최적화
    typeCast: true, // 타입 캐스팅 활성화
    rowsAsArray: false, // 객체 형태로 결과 반환
    namedPlaceholders: false, // 위치 기반 플레이스홀더 사용 (성능 향상)
    
    // 타임존 설정
    timezone: 'Z', // UTC 타임존 사용
});

// 연결 풀 이벤트 리스너
db.on('connection', (connection) => {
    logger.info('🔗 새로운 데이터베이스 연결 생성', { threadId: connection.threadId });
});

db.on('acquire', (connection) => {
    // 성능 최적화: debug 로그 제거
    // logger.debug('📥 데이터베이스 연결 획득', { threadId: connection.threadId });
});

db.on('release', (connection) => {
    // 성능 최적화: debug 로그 제거
    // logger.debug('📤 데이터베이스 연결 해제', { threadId: connection.threadId });
});

db.on('error', (err) => {
    logger.error('❌ 데이터베이스 연결 오류', { error: err.message, stack: err.stack });
});

module.exports = db;