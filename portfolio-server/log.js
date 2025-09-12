require('dotenv').config();

const fs = require("fs");
const path = require('path');
const winston = require('winston');
const DailyRotateFile = require('winston-daily-rotate-file');

const logDir = path.join(__dirname, 'logs');
// ensure log directory exists (async)
fs.promises.mkdir(logDir, { recursive: true })
  .catch(err => {
    // logger가 아직 초기화되지 않았으므로 console.error 사용
    console.error(`Failed to create log directory ${logDir}`, err);
  });

const transport = new DailyRotateFile({
    dirname : logDir,
    filename : '%DATE%.log',
    datePattern : 'YYYY-MM-DD',
    zippedArchive : false,
    maxSize : '20m',
    maxFiles : '14d'
});

const logger = winston.createLogger({
    level : process.env.LOG_LEVEL || 'warn', // 기본 레벨을 warn으로 변경
    format : winston.format.combine(
        winston.format.timestamp({ format : 'YYYY-MM-DD HH:mm:ss'}),
        winston.format.errors({ stack: true }),
        winston.format.json(),
        winston.format.printf(({ timestamp, level, message, stack, ...meta }) => {
            let log = `${timestamp} [${level.toUpperCase()}]: ${message}`;
            // 메타데이터가 있을 때만 JSON 변환 (성능 최적화)
            if (Object.keys(meta).length > 0) {
                log += ` | ${JSON.stringify(meta)}`;
            }
            if (stack) {
                log += `\n${stack}`;
            }
            return log;
        })
    ),

    transports : [
        transport,
        new winston.transports.Console({
            format: winston.format.combine(
                winston.format.colorize(),
                winston.format.simple()
            )
        })
    ]
});

// 로그 레벨별 헬퍼 함수들
logger.request = (req, message = 'API 요청') => {
    logger.info(message, {
        method: req.method,
        url: req.originalUrl,
        ip: req.ip,
        userAgent: req.headers['user-agent'],
        body: req.method !== 'GET' ? req.body : undefined,
        query: Object.keys(req.query || {}).length > 0 ? req.query : undefined
    });
};

logger.response = (req, res, message = 'API 응답') => {
    logger.info(message, {
        method: req.method,
        url: req.originalUrl,
        statusCode: res.statusCode,
        ip: req.ip,
        responseTime: res.get('X-Response-Time')
    });
};

logger.auth = (message, user = null, extra = {}) => {
    logger.info(`[인증] ${message}`, {
        user: user ? { id: user.id, username: user.username, role: user.role } : null,
        ...extra
    });
};

logger.database = (message, extra = {}) => {
    logger.info(`[데이터베이스] ${message}`, extra);
};

logger.security = (message, extra = {}) => {
    logger.warn(`[보안] ${message}`, extra);
};

logger.admin = (message, admin = null, extra = {}) => {
    logger.info(`[관리자] ${message}`, {
        admin: admin ? { id: admin.id, username: admin.username, role: admin.role } : null,
        ...extra
    });
};

// 🎯 활동 추적 로깅 (사용자 행동 및 시스템 동작)
logger.activity = (action, details = {}, user = null) => {
    // 활동 유형 분류
    let category = '일반';
    if (action.includes('로그인')) category = '인증';
    else if (action.includes('로그아웃')) category = '인증';
    else if (action.includes('관리자')) category = '관리';
    else if (action.includes('데이터')) category = '데이터';
    else if (action.includes('에러')) category = '에러';
    else if (action.includes('성능')) category = '성능';
    else if (action.includes('보안')) category = '보안';
    
    logger.info(`[활동:${category}] ${action}`, {
        action,
        category,
        user: user ? { id: user.id, username: user.username, role: user.role } : null,
        timestamp: new Date().toISOString(),
        ...details
    });
};

// 📊 데이터베이스 작업 로깅
logger.database = (operation, table, details = {}) => {
    // 작업 유형 분류
    let category = 'SELECT';
    if (operation.includes('INSERT')) category = 'INSERT';
    else if (operation.includes('UPDATE')) category = 'UPDATE';
    else if (operation.includes('DELETE')) category = 'DELETE';
    else if (operation.includes('실패')) category = 'ERROR';
    
    logger.info(`[데이터베이스:${category}] ${operation}`, {
        operation,
        table,
        category,
        timestamp: new Date().toISOString(),
        ...details
    });
};

// 🔍 API 사용 통계 로깅
logger.apiUsage = (endpoint, method, user = null, responseTime = null) => {
    // API 유형 분류
    let category = 'PUBLIC';
    if (endpoint.includes('/admin')) category = 'ADMIN';
    else if (endpoint.includes('/login')) category = 'AUTH';
    else if (endpoint.includes('/logout')) category = 'AUTH';
    
    // 성능 등급 분류
    let performance = 'NORMAL';
    if (responseTime > 2000) performance = 'SLOW';
    else if (responseTime > 1000) performance = 'MODERATE';
    else if (responseTime < 100) performance = 'FAST';
    
    logger.info(`[API사용:${category}] ${method} ${endpoint}`, {
        endpoint,
        method,
        category,
        performance,
        user: user ? { id: user.id, username: user.username } : null,
        responseTime: responseTime ? `${responseTime}ms` : null,
        timestamp: new Date().toISOString()
    });
};

// 📈 로그 통계 및 집계 기능
logger.stats = {
    counters: {
        totalRequests: 0,
        adminRequests: 0,
        publicRequests: 0,
        loginAttempts: 0,
        loginSuccess: 0,
        loginFailures: 0,
        errors: 0,
        slowRequests: 0
    },
    
    // 통계 업데이트
    updateStats(type, value = 1) {
        if (this.counters.hasOwnProperty(type)) {
            this.counters[type] += value;
        }
    },
    
    // 통계 초기화
    resetStats() {
        Object.keys(this.counters).forEach(key => {
            this.counters[key] = 0;
        });
    },
    
    // 통계 로깅
    logStats() {
        logger.info('📊 시스템 통계', {
            stats: this.counters,
            timestamp: new Date().toISOString()
        });
    }
};

// 통계 업데이트를 위한 헬퍼 함수들
logger.incrementCounter = (type, value = 1) => {
    logger.stats.updateStats(type, value);
};

// 시간 기반 통계 리셋 (1시간마다)
setInterval(() => {
    logger.stats.logStats();
    logger.stats.resetStats();
}, 60 * 60 * 1000); // 1시간

module.exports = logger;