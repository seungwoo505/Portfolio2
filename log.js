require('dotenv').config();

const fs = require("fs");
const path = require('path');
const winston = require('winston');
const DailyRotateFile = require('winston-daily-rotate-file');

const logDir = path.join(__dirname, 'logs');
fs.promises.mkdir(logDir, { recursive: true })
  .catch(err => {
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
    level : process.env.LOG_LEVEL || 'warn',
    format : winston.format.combine(
        winston.format.timestamp({ format : 'YYYY-MM-DD HH:mm:ss'}),
        winston.format.errors({ stack: true }),
        winston.format.json(),
        winston.format.printf(({ timestamp, level, message, stack, ...meta }) => {
            let log = `${timestamp} [${level.toUpperCase()}]: ${message}`;
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

const isVerboseEnabled = process.env.ENABLE_VERBOSE_LOGS === 'true';

logger.request = (req, message = 'API 요청') => {
    if (!isVerboseEnabled) {
        return;
    }
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
    if (!isVerboseEnabled) {
        return;
    }
    logger.info(message, {
        method: req.method,
        url: req.originalUrl,
        statusCode: res.statusCode,
        ip: req.ip,
        responseTime: res.get('X-Response-Time')
    });
};

logger.auth = (message, user = null, extra = {}) => {
    if (!isVerboseEnabled) {
        return;
    }
    logger.info(`[인증] ${message}`, {
        user: user ? { id: user.id, username: user.username, role: user.role } : null,
        ...extra
    });
};

logger.database = (message, extra = {}) => {
    if (!isVerboseEnabled) {
        return;
    }
    logger.info(`[데이터베이스] ${message}`, extra);
};

logger.security = (message, extra = {}) => {
    logger.warn(`[보안] ${message}`, extra);
};

logger.admin = (message, admin = null, extra = {}) => {
    if (!isVerboseEnabled) {
        return;
    }
    logger.info(`[관리자] ${message}`, {
        admin: admin ? { id: admin.id, username: admin.username, role: admin.role } : null,
        ...extra
    });
};

logger.activity = (action, details = {}, user = null) => {
    if (!isVerboseEnabled) {
        return;
    }
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

logger.database = (operation, table, details = {}) => {
    if (!isVerboseEnabled) {
        return;
    }
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

logger.apiUsage = (endpoint, method, user = null, responseTime = null) => {
    if (!isVerboseEnabled) {
        return;
    }
    let category = 'PUBLIC';
    if (endpoint.includes('/admin')) category = 'ADMIN';
    else if (endpoint.includes('/login')) category = 'AUTH';
    else if (endpoint.includes('/logout')) category = 'AUTH';
    
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
    
    /**
     * @description 로그 통계를 업데이트한다.
      * @param {*} type 입력값
      * @param {*} value 입력값
     * @returns {any} 처리 결과
     */
    updateStats(type, value = 1) {
        if (this.counters.hasOwnProperty(type)) {
            this.counters[type] += value;
        }
    },
    
    /**
     * @description 로그 통계를 초기화한다.
     * @returns {any} 처리 결과
     */
    resetStats() {
        Object.keys(this.counters).forEach(key => {
            this.counters[key] = 0;
        });
    },
    
    /**
     * @description 로그 통계를 기록한다.
     * @returns {any} 처리 결과
     */
    logStats() {
        logger.info('시스템 통계', {
            stats: this.counters,
            timestamp: new Date().toISOString()
        });
    }
};

logger.incrementCounter = (type, value = 1) => {
    if (isVerboseEnabled) {
        logger.stats.updateStats(type, value);
    }
};

setInterval(() => {
    if (isVerboseEnabled) {
        logger.stats.logStats();
        logger.stats.resetStats();
    }
}, 60 * 60 * 1000);

module.exports = logger;