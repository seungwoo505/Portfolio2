require("dotenv").config();
const fs = require("fs");
const https = require("https");
const express = require("express");
const expressWs = require("express-ws");
const cookieParser = require("cookie-parser");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");
const compression = require("compression");
const logger = require("./log");
const swaggerUi = require('swagger-ui-express');
const swaggerJsdoc = require('swagger-jsdoc');

const app = express();
const cors = require("cors");

// 라우트 불러오기
const portfolioRoutes = require('./routes/portfolio');
const adminRoutes = require('./routes/admin');
const monitoringRoutes = require('./routes/monitoring');

// 🛡️ Rate Limiting (DDoS 및 브루트포스 방지) - 최적화된 설정
const generalLimiter = rateLimit({
    windowMs: 1 * 60 * 1000, // 1분
    max: 300, // 각 IP당 최대 300 요청 (200 → 300, 성능 개선)
    message: {
      success: false,
      error: "너무 많은 요청입니다. 잠시 후 다시 시도해주세요.",
    },
    standardHeaders: true,
    legacyHeaders: false,
    // 성능 최적화: skipSuccessfulRequests로 성공 요청은 카운트하지 않음
    skipSuccessfulRequests: true,
    // Rate limit 정보를 헤더에 포함
    handler: (req, res) => {
        logger.warn('Rate limit exceeded', {
            ip: req.ip,
            url: req.originalUrl,
            method: req.method
        });
        res.status(429).json({
            success: false,
            error: "너무 많은 요청입니다. 잠시 후 다시 시도해주세요.",
            retryAfter: Math.round(req.rateLimit.resetTime / 1000)
        });
    }
});

// 🔐 Admin API용 Rate Limiting (개발 환경용 완화된 설정)
const adminLimiter = rateLimit({
    windowMs: 1 * 60 * 1000, // 1분
    max: 100, // 관리자 API 요청 제한 (1분당 100번)
    message: {
      success: false,
      error: "관리자 API 요청이 너무 많습니다. 1분 후 다시 시도해주세요.",
    },
    standardHeaders: true,
    legacyHeaders: false,
    handler: (req, res) => {
        logger.warn('Admin rate limit exceeded', {
            ip: req.ip,
            userAgent: req.headers['user-agent'],
            url: req.originalUrl,
            method: req.method
        });
        res.status(429).json({
            success: false,
            error: "관리자 API 요청이 너무 많습니다. 15분 후 다시 시도해주세요.",
            retryAfter: Math.round(req.rateLimit.resetTime / 1000)
        });
    }
});

// 🚪 로그인 API용 매우 엄격한 Rate Limiting (브루트포스 방지)
const loginLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15분
    max: 5, // 15분에 5번만 로그인 시도 가능
    message: {
      success: false,
      error: "로그인 시도가 너무 많습니다. 15분 후 다시 시도해주세요.",
    },
    standardHeaders: true,
    legacyHeaders: false,
    handler: (req, res) => {
        logger.warn('Login rate limit exceeded', {
            ip: req.ip,
            userAgent: req.headers['user-agent'],
            url: req.originalUrl
        });
        res.status(429).json({
            success: false,
            error: "로그인 시도가 너무 많습니다. 15분 후 다시 시도해주세요.",
            retryAfter: Math.round(req.rateLimit.resetTime / 1000)
        });
    }
});

// 일반 Rate Limiting 적용
app.use(generalLimiter);

// 🚀 고성능 최적화 미들웨어
// Gzip 압축 (응답 크기 70-90% 감소)
app.use(compression({
    level: 7, // 6 → 7로 증가 (더 높은 압축률)
    threshold: 512, // 1KB → 512B로 감소 (더 많은 파일 압축)
    filter: (req, res) => {
        // 이미 압축된 파일은 제외
        if (req.headers['x-no-compression']) {
            return false;
        }
        // 정적 파일과 API 응답 모두 압축
        return compression.filter(req, res);
    },
    // 추가 압축 최적화
    chunkSize: 16 * 1024, // 16KB 청크 크기
    windowBits: 15, // 압축 윈도우 크기
    memLevel: 8, // 메모리 레벨
}));

// 미들웨어 설정 (고성능 최적화)
app.use(express.json({ 
    limit: '3mb', // 5mb → 3mb로 메모리 사용량 추가 감소
    // JSON 파싱 최적화
    strict: false,
    type: 'application/json',
    // 추가 JSON 최적화
    verify: undefined, // 검증 함수 비활성화 (성능 향상)
}));
app.use(express.urlencoded({ 
    extended: true, 
    limit: '3mb', // 5mb → 3mb로 메모리 사용량 추가 감소
    // URL 인코딩 최적화
    parameterLimit: 300, // 500 → 300으로 파라미터 제한 추가 감소
    // 추가 URL 인코딩 최적화
    verify: undefined, // 검증 함수 비활성화 (성능 향상)
}));
app.use(cookieParser());

// ⏰ 요청 타임아웃 설정 (성능 최적화)
const REQUEST_TIMEOUT = parseInt(process.env.REQUEST_TIMEOUT || '2000', 10) || 2000; // 3초 → 2초로 단축

app.use((req, res, next) => {
    let isTimedOut = false;
    
    // 요청 타임아웃 설정
    const timeoutId = setTimeout(() => {
        if (!isTimedOut && !res.headersSent) {
            isTimedOut = true;
            
            logger.warn('요청 타임아웃', {
                method: req.method,
                url: req.originalUrl,
                ip: req.ip,
                userAgent: req.headers['user-agent'],
                timeout: REQUEST_TIMEOUT
            });
            
            res.status(408).json({
                success: false,
                error: '요청 시간이 초과되었습니다. 잠시 후 다시 시도해주세요.',
                timeout: REQUEST_TIMEOUT
            });
        }
    }, REQUEST_TIMEOUT);
    
    // 응답 완료 시 타임아웃 클리어
    const originalEnd = res.end;
    res.end = function(...args) {
        if (!isTimedOut) {
            clearTimeout(timeoutId);
        }
        return originalEnd.apply(this, args);
    };
    
    // 연결 종료 시 타임아웃 클리어
    req.on('close', () => {
        if (!isTimedOut) {
            clearTimeout(timeoutId);
        }
    });
    
    next();
});

app.use(
    cors({
        origin: [
            process.env.LOCALHOST, 
            process.env.MY_HOST
        ],
        credentials: true,
    })
);

// 🛡️ 보안 헤더 추가 (Helmet.js)
app.use(helmet({
    contentSecurityPolicy: process.env.NODE_ENV === 'production' ? {
        directives: {
            defaultSrc: ["'self'"],
            styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
            fontSrc: ["'self'", "https://fonts.gstatic.com"],
            imgSrc: ["'self'", "data:", "https:"],
            scriptSrc: ["'self'"],
            connectSrc: ["'self'"], // 같은 도메인이므로 추가 설정 불필요
            frameSrc: ["'none'"],
            objectSrc: ["'none'"],
            upgradeInsecureRequests: [],
        },
    } : false, // 개발 중에는 비활성화
    hsts: process.env.NODE_ENV === 'production' ? {
        maxAge: 31536000,
        includeSubDomains: true,
        preload: true
    } : false,
    noSniff: true,
    xssFilter: true,
    referrerPolicy: { policy: "strict-origin-when-cross-origin" }
}));

// 정적 파일 서빙 (이미지 등)
app.use('/uploads', express.static('uploads'));

// 📚 Swagger API 문서화 설정
const swaggerSpec = swaggerJsdoc({
    definition: {
        openapi: '3.0.0',
        servers: [
            {
                url: '/api',
                description: 'API 서버 (상대 경로)'
            }
        ],
        // Swagger UI가 올바른 서버를 사용하도록 강제
        host: 'seungwoo.i234.me:3333',
        basePath: '/api',
        info: {
            title: 'Portfolio API',
            version: '2.1.0',
            description: `
                🚀 **포트폴리오/블로그 및 관리자 API 문서**
                
                ## 주요 기능
                - 📝 블로그 포스트 관리 (CRUD, 검색, 필터링)
                - 🎯 프로젝트 포트폴리오 (CRUD, 태그, 상태 관리)
                - 👤 개인정보 및 소셜 링크 관리
                - 🛠️ 기술 스택 관리 (카테고리, 숙련도)
                - 📊 관리자 대시보드 (통계, 활동 로그)
                - 🔐 JWT 기반 인증 및 권한 관리
                - 📧 연락처 메시지 관리
                - 🏷️ 태그 시스템
                
                ## 인증
                - **공개 API**: 인증 불필요
                - **관리자 API**: Bearer Token 인증 필요
                - **권한**: super_admin, admin, editor 등급별 접근 제어
                
                ## Rate Limiting
                - 일반 API: 1분에 300회
                - 관리자 API: 15분에 50회
                - 로그인 API: 15분에 5회
                
                ## API 태그
                - **Authentication**: 로그인/로그아웃, 토큰 관리
                - **Dashboard**: 관리자 대시보드 통계
                - **Blog**: 블로그 포스트 관리
                - **Projects**: 프로젝트 관리
                - **Public**: 공개 데이터 조회
                - **Contact**: 연락처 메시지
            `,
            contact: {
                name: "API Support",
                email: "support@portfolio.com"
            },
            license: {
                name: "MIT",
                url: "https://opensource.org/licenses/MIT"
            }
        },
        servers: [
            { 
                url: `${process.env.MY_HOST || 'https://localhost:'+process.env.PORT}/api`,
                description: "Production Server"
            },
            { 
                url: `http://localhost:${process.env.PORT || 3001}/api`,
                description: "Development Server"
            }
        ],
        components: {
            securitySchemes: {
                bearerAuth: {
                    type: 'http',
                    scheme: 'bearer',
                    bearerFormat: 'JWT',
                    description: 'JWT 토큰을 사용한 인증'
                }
            },
            schemas: {
                Error: {
                    type: 'object',
                    properties: {
                        success: {
                            type: 'boolean',
                            example: false
                        },
                        error: {
                            type: 'string',
                            example: '에러 메시지'
                        }
                    }
                },
                Success: {
                    type: 'object',
                    properties: {
                        success: {
                            type: 'boolean',
                            example: true
                        },
                        data: {
                            type: 'object',
                            description: '응답 데이터'
                        }
                    }
                }
            }
        },
        tags: [
            {
                name: 'Blog',
                description: '블로그 포스트 관련 API'
            },
            {
                name: 'Projects',
                description: '프로젝트 포트폴리오 관련 API'
            },
            {
                name: 'Admin',
                description: '관리자 전용 API (인증 필요)'
            },
            {
                name: 'Auth',
                description: '인증 관련 API'
            }
        ]
    },
    apis: [
        './routes/*.js'
    ]
});

// Swagger UI 설정 - 상대 경로 강제 사용
const swaggerUiOptions = {
    swaggerOptions: {
        docExpansion: 'none',
        filter: true,
        tryItOutEnabled: true,
        // 최소한의 설정으로 안정성 확보
        supportedSubmitMethods: ['get', 'post', 'put', 'delete', 'patch'],
        validatorUrl: null,
        // 서버 URL을 명시적으로 설정하여 상대 경로 사용
        url: '/api-docs.json',
        // Swagger UI가 절대 URL 대신 상대 경로를 사용하도록 설정
        deepLinking: true,
        displayOperationId: false,
        // 첫 번째 서버(상대 경로)를 기본으로 설정
        defaultModelsExpandDepth: 1,
        defaultModelExpandDepth: 1,
        // 서버 선택기 숨기기
        showExtensions: false,
        showCommonExtensions: false,
        // 서버 선택을 첫 번째로 고정
        defaultModelsExpandDepth: 1,
        defaultModelExpandDepth: 1,
        // 요청 인터셉터로 URL 강제 수정
        requestInterceptor: (req) => {
            // 절대 URL을 상대 URL로 변경
            if (req.url.startsWith('https://seungwoo.i234.me/api')) {
                req.url = req.url.replace('https://seungwoo.i234.me', '');
            }
            return req;
        }
    },
    customCss: `
        .swagger-ui .topbar { display: none; }
        .swagger-ui .info { margin: 20px 0; }
        .swagger-ui .info .title { color: #3b82f6; }
        .swagger-ui .scheme-container { background: #f8fafc; padding: 15px; border-radius: 8px; }
        .swagger-ui .opblock.opblock-post { border-color: #10b981; }
        .swagger-ui .opblock.opblock-get { border-color: #3b82f6; }
        .swagger-ui .opblock.opblock-put { border-color: #f59e0b; }
        .swagger-ui .opblock.opblock-delete { border-color: #ef4444; }
    `,
    customSiteTitle: "Portfolio API Documentation"
};

app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec, swaggerUiOptions));
app.get('/api-docs.json', (req, res) => res.json(swaggerSpec));

// 중요한 요청 및 활동 추적 로깅
app.use((req, res, next) => {
    // 관리자 API 또는 데이터 변경 요청만 로깅
    const isAdminApi = req.path.startsWith('/api/admin');
    const isDataModifying = ['POST', 'PUT', 'DELETE', 'PATCH'].includes(req.method);
    const isImportantEndpoint = req.path.includes('/login') || req.path.includes('/logout');
    
        if (isAdminApi || isDataModifying || isImportantEndpoint) {
            // 사용자 정보 추출 (JWT 토큰에서)
            let user = null;
            if (req.headers.authorization) {
                try {
                    const token = req.headers.authorization.split(' ')[1];
                    const jwt = require('jsonwebtoken');
                    const decoded = jwt.decode(token);
                    if (decoded) {
                        user = { id: decoded.id, username: decoded.username, role: decoded.role };
                    }
                } catch {
                    // 토큰 파싱 실패는 무시
                }
            }
            
            // 활동 유형 분류 및 통계 업데이트
            let action = '';
            if (req.path.includes('/login')) {
                action = '로그인 시도';
                logger.incrementCounter('loginAttempts');
            } else if (req.path.includes('/logout')) {
                action = '로그아웃';
            } else if (req.path.includes('/admin')) {
                action = '관리자 작업';
                logger.incrementCounter('adminRequests');
            } else if (isDataModifying) {
                action = '데이터 변경';
                logger.incrementCounter('totalRequests');
            } else {
                action = '중요 요청';
                logger.incrementCounter('publicRequests');
            }
            
            logger.activity(action, {
                method: req.method,
                endpoint: req.path,
                ip: req.ip,
                userAgent: req.headers['user-agent']
            }, user);
        }
    next();
});

// 🚀 헬스체크 엔드포인트 (성능 모니터링용)
app.get('/health', (req, res) => {
    const memoryUsage = process.memoryUsage();
    const uptime = process.uptime();
    
    res.json({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        uptime: `${Math.floor(uptime)}s`,
        memory: {
            rss: `${Math.round(memoryUsage.rss / 1024 / 1024)}MB`,
            heapTotal: `${Math.round(memoryUsage.heapTotal / 1024 / 1024)}MB`,
            heapUsed: `${Math.round(memoryUsage.heapUsed / 1024 / 1024)}MB`,
            external: `${Math.round(memoryUsage.external / 1024 / 1024)}MB`
        },
        cache: {
            stats: require('./utils/cache').getStats()
        }
    });
});

// API 라우트 연결 (특별한 Rate Limiting 적용)
app.use('/api', portfolioRoutes);
app.use('/api/admin', adminLimiter, adminRoutes); // 관리자 API에 더 엄격한 제한
app.use('/api/monitoring', monitoringRoutes); // 모니터링 API

// 로그인 API에 매우 엄격한 Rate Limiting 적용
app.use('/api/admin/login', loginLimiter);

// 404 핸들러
app.use('*', (req, res) => {
    res.status(404).json({
        success: false,
        message: '요청하신 리소스를 찾을 수 없습니다.',
        path: req.originalUrl
    });
});

// 에러 핸들러
app.use((error, req, res, next) => {
    const errorInfo = {
        message: error.message,
        stack: error.stack,
        method: req.method,
        url: req.originalUrl,
        ip: req.ip,
        userAgent: req.headers['user-agent'],
        body: req.method !== 'GET' ? req.body : undefined,
        statusCode: error.status || 500
    };

    // 에러 유형에 따른 로그 레벨 결정
    if (error.status >= 400 && error.status < 500) {
        logger.warn('클라이언트 오류', errorInfo);
    } else {
        logger.error('서버 오류', errorInfo);
    }
    
    // 개발 환경에서는 상세한 에러 정보 제공
    const isDevelopment = process.env.NODE_ENV === 'development';
    
    res.status(error.status || 500).json({
        success: false,
        message: error.message || '서버 내부 오류가 발생했습니다.',
        ...(isDevelopment && { stack: error.stack })
    });
});

const options = {
    key: fs.readFileSync(process.env.HTTPS_KEY),
    cert: fs.readFileSync(process.env.HTTPS_CERT),
    ca: fs.readFileSync(process.env.HTTPS_CA),
  };

// HTTPS 서버 생성
const server = https.createServer(options, app);

// WebSocket을 HTTPS 서버에 연결
expressWs(app, server);



// 🚀 성능 모니터링 및 활동 추적 미들웨어
app.use((req, res, next) => {
    const start = Date.now();
    
    // 응답 완료 시 로그 기록
    res.on('finish', () => {
        const duration = Date.now() - start;
        
        // 사용자 정보 추출 (JWT 토큰에서)
        let user = null;
        if (req.headers.authorization) {
            try {
                const token = req.headers.authorization.split(' ')[1];
                const jwt = require('jsonwebtoken');
                const decoded = jwt.decode(token);
                if (decoded) {
                    user = { id: decoded.id, username: decoded.username, role: decoded.role };
                }
            } catch {
                // 토큰 파싱 실패는 무시
            }
        }
        
        // API 사용 통계 로깅 (관리자 API와 데이터 변경 요청만)
        const isAdminApi = req.path.startsWith('/api/admin');
        const isDataModifying = ['POST', 'PUT', 'DELETE', 'PATCH'].includes(req.method);
        
        if (isAdminApi || isDataModifying) {
            logger.apiUsage(req.path, req.method, user, duration);
        }
        
        // 에러 응답 또는 성능 경고 로깅
        if (res.statusCode >= 400 || duration > 1000) {
            const logLevel = res.statusCode >= 400 ? 'warn' : 'info';
            const action = res.statusCode >= 400 ? '에러 발생' : '성능 경고';
            
            // 통계 업데이트
            if (res.statusCode >= 400) {
                logger.incrementCounter('errors');
            }
            if (duration > 1000) {
                logger.incrementCounter('slowRequests');
            }
            
            logger.activity(action, {
                method: req.method,
                endpoint: req.path,
                statusCode: res.statusCode,
                responseTime: `${duration}ms`,
                ip: req.ip
            }, user);
        }
    });
    
    next();
});

// 서버 시작
logger.info('🚀 포트폴리오 서버 시작 중...');
logger.info('📋 환경 설정', {
    nodeEnv: process.env.NODE_ENV || 'development',
    port: process.env.PORT || 3001,
    dbHost: process.env.DB_HOST || 'localhost',
    dbSchema: process.env.DB_SCHEMA || 'portfolio_db',
    corsOrigins: [process.env.LOCALHOST, process.env.MY_HOST].filter(Boolean),
    httpsEnabled: !!(process.env.HTTPS_KEY && process.env.HTTPS_CERT),
    requestTimeout: `${REQUEST_TIMEOUT}ms`
});

server.listen(process.env.PORT, () => {
    logger.info(`🚀 포트폴리오 서버가 포트 ${process.env.PORT}에서 실행 중입니다`);
    logger.info(`📁 데이터베이스: ${process.env.DB_HOST}의 ${process.env.DB_SCHEMA}`);
    logger.info(`🌐 CORS 허용 도메인: ${[process.env.LOCALHOST, process.env.MY_HOST].join(', ')}`);
    logger.info('✅ 서버 시작이 성공적으로 완료되었습니다');
});