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
const portfolioRoutes = require('./routes/portfolio');
const adminRoutes = require('./routes/admin');
const monitoringRoutes = require('./routes/monitoring');
const generalLimiter = rateLimit({
    windowMs: 1 * 60 * 1000,
    max: 300,
    message: {
      success: false,
      error: "너무 많은 요청입니다. 잠시 후 다시 시도해주세요.",
    },
    standardHeaders: true,
    legacyHeaders: false,
    skipSuccessfulRequests: true,
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
const adminLimiter = rateLimit({
    windowMs: 1 * 60 * 1000,
    max: 100,
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
const loginLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 5,
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
app.use(generalLimiter);
app.use(compression({
    level: 7,
    threshold: 512,
    filter: (req, res) => {
        if (req.headers['x-no-compression']) {
            return false;
        }
        return compression.filter(req, res);
    },
    chunkSize: 16 * 1024,
    windowBits: 15,
    memLevel: 8,
}));
app.use(express.json({ 
    limit: '3mb',
    strict: false,
    type: 'application/json',
    verify: undefined,
}));
app.use(express.urlencoded({ 
    extended: true, 
    limit: '3mb',
    parameterLimit: 300,
    verify: undefined,
}));
app.use(cookieParser());
const REQUEST_TIMEOUT = parseInt(process.env.REQUEST_TIMEOUT || '2000', 10) || 2000;

app.use((req, res, next) => {
    let isTimedOut = false;
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
    const originalEnd = res.end;
    res.end = function(...args) {
        if (!isTimedOut) {
            clearTimeout(timeoutId);
        }
        return originalEnd.apply(this, args);
    };
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
app.use(helmet({
    contentSecurityPolicy: process.env.NODE_ENV === 'production' ? {
        directives: {
            defaultSrc: ["'self'"],
            styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
            fontSrc: ["'self'", "https://fonts.gstatic.com"],
            imgSrc: ["'self'", "data:", "https:"],
            scriptSrc: ["'self'"],
            connectSrc: ["'self'"],
            frameSrc: ["'none'"],
            objectSrc: ["'none'"],
            upgradeInsecureRequests: [],
        },
    } : false,
    hsts: process.env.NODE_ENV === 'production' ? {
        maxAge: 31536000,
        includeSubDomains: true,
        preload: true
    } : false,
    noSniff: true,
    xssFilter: true,
    referrerPolicy: { policy: "strict-origin-when-cross-origin" }
}));
app.use('/uploads', express.static('uploads'));
const swaggerSpec = swaggerJsdoc({
    definition: {
        openapi: '3.0.0',
        info: {
            title: 'Portfolio API',
            version: '2.1.0',
            description: `
                 **포트폴리오/블로그 및 관리자 API 문서**
                
                ## 주요 기능
                -  블로그 포스트 관리 (CRUD, 검색, 필터링)
                -  프로젝트 포트폴리오 (CRUD, 태그, 상태 관리)
                -  개인정보 및 소셜 링크 관리
                -  기술 스택 관리 (카테고리, 숙련도)
                -  관리자 대시보드 (통계, 활동 로그)
                -  JWT 기반 인증 및 권한 관리
                -  연락처 메시지 관리
                -  태그 시스템
                
                ## 인증
                - **공개 API**: 인증 불필요
                - **관리자 API**: Bearer Token 인증 필요
                - **권한**: super_admin, admin, editor 등급별 접근 제어
                
                ## Rate Limiting
                - 일반 API: 1분에 300회
                - 관리자 API: 1분에 100회
                - 로그인 API: 15분에 5회
                
                ## API 태그
                - **Authentication**: 로그인/로그아웃, 토큰 관리
                - **Dashboard**: 관리자 대시보드 통계
                - **Blog**: 블로그 포스트 관리
                - **Projects**: 프로젝트 관리
                - **Profile**: 개인정보 조회/수정
                - **Social**: 소셜 링크 관리
                - **Skills**: 기술 스택 관리
                - **Tags**: 태그 데이터
                - **Experiences**: 경력 관리
                - **Contact**: 연락처 메시지
                - **Settings**: 사이트 설정
                - **Search**: 검색 관련 API
                - **Health**: 서비스 상태 확인
                - **Monitoring**: 시스템 모니터링
                - **AI**: AI 지원 기능
                - **Logs**: 시스템 활동 로그
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
                PaginationMeta: {
                    type: 'object',
                    properties: {
                        page: { type: 'integer', example: 1 },
                        limit: { type: 'integer', example: 10 },
                        total: { type: 'integer', example: 42 },
                        totalPages: { type: 'integer', example: 5 }
                    }
                },
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
                ErrorResponse: {
                    type: 'object',
                    properties: {
                        success: {
                            type: 'boolean',
                            example: false
                        },
                        message: {
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
                name: 'Authentication',
                description: '관리자 인증 및 토큰 관리'
            },
            {
                name: 'Dashboard',
                description: '관리자 대시보드 통계'
            },
            {
                name: 'Blog',
                description: '블로그 포스트 관련 API'
            },
            {
                name: 'Projects',
                description: '프로젝트 포트폴리오 관련 API'
            },
            {
                name: 'Profile',
                description: '개인 프로필 정보'
            },
            {
                name: 'Social',
                description: '소셜 링크 및 외부 프로필'
            },
            {
                name: 'Skills',
                description: '기술 스택 및 카테고리'
            },
            {
                name: 'Tags',
                description: '태그 관리 및 조회'
            },
            {
                name: 'Experiences',
                description: '경력 및 활동'
            },
            {
                name: 'Contact',
                description: '연락처 메시지 관리'
            },
            {
                name: 'Settings',
                description: '사이트 설정 관련 API'
            },
            {
                name: 'Search',
                description: '검색 기능'
            },
            {
                name: 'Health',
                description: '서비스 상태 및 헬스 체크'
            },
            {
                name: 'Monitoring',
                description: '시스템 모니터링 및 캐시 제어'
            },
            {
                name: 'AI',
                description: 'AI 기반 도우미 기능'
            },
            {
                name: 'Logs',
                description: '시스템 및 관리자 로그'
            },
            {
                name: 'Admin',
                description: '관리자 전용 리소스'
            }
        ]
    },
    apis: [
        './routes/*.js'
    ]
});
const swaggerUiOptions = {
    swaggerOptions: {
        docExpansion: 'none',
        filter: true,
        tryItOutEnabled: true,
        supportedSubmitMethods: ['get', 'post', 'put', 'delete', 'patch'],
        validatorUrl: null,
        url: '/api-docs.json',
        deepLinking: true,
        displayOperationId: false,
        defaultModelsExpandDepth: 1,
        defaultModelExpandDepth: 1,
        showExtensions: false,
        showCommonExtensions: false,
        defaultModelsExpandDepth: 1,
        defaultModelExpandDepth: 1,
        requestInterceptor: (req) => {
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
app.use((req, res, next) => {
    const isAdminApi = req.path.startsWith('/api/admin');
    const isDataModifying = ['POST', 'PUT', 'DELETE', 'PATCH'].includes(req.method);
    const isImportantEndpoint = req.path.includes('/login') || req.path.includes('/logout');
    
        if (isAdminApi || isDataModifying || isImportantEndpoint) {
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
                }
            }
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
app.use('/api', portfolioRoutes);
app.use('/api/admin', adminLimiter, adminRoutes);
app.use('/api/monitoring', monitoringRoutes);
app.use('/api/admin/login', loginLimiter);
app.use('*', (req, res) => {
    res.status(404).json({
        success: false,
        message: '요청하신 리소스를 찾을 수 없습니다.',
        path: req.originalUrl
    });
});
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
    if (error.status >= 400 && error.status < 500) {
        logger.warn('클라이언트 오류', errorInfo);
    } else {
        logger.error('서버 오류', errorInfo);
    }
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
const server = https.createServer(options, app);
expressWs(app, server);
app.use((req, res, next) => {
    const start = Date.now();
    res.on('finish', () => {
        const duration = Date.now() - start;
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
            }
        }
        const isAdminApi = req.path.startsWith('/api/admin');
        const isDataModifying = ['POST', 'PUT', 'DELETE', 'PATCH'].includes(req.method);
        
        if (isAdminApi || isDataModifying) {
            logger.apiUsage(req.path, req.method, user, duration);
        }
        if (res.statusCode >= 400 || duration > 1000) {
            const logLevel = res.statusCode >= 400 ? 'warn' : 'info';
            const action = res.statusCode >= 400 ? '에러 발생' : '성능 경고';
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
logger.info('포트폴리오 서버 시작 중...');
logger.info('환경 설정', {
    nodeEnv: process.env.NODE_ENV || 'development',
    port: process.env.PORT || 3001,
    dbHost: process.env.DB_HOST || 'localhost',
    dbSchema: process.env.DB_SCHEMA || 'portfolio_db',
    corsOrigins: [process.env.LOCALHOST, process.env.MY_HOST].filter(Boolean),
    httpsEnabled: !!(process.env.HTTPS_KEY && process.env.HTTPS_CERT),
    requestTimeout: `${REQUEST_TIMEOUT}ms`
});

server.listen(process.env.PORT, () => {
    logger.info(`포트폴리오 서버가 포트 ${process.env.PORT}에서 실행 중입니다`);
    logger.info(`데이터베이스: ${process.env.DB_HOST}의 ${process.env.DB_SCHEMA}`);
    logger.info(`CORS 허용 도메인: ${[process.env.LOCALHOST, process.env.MY_HOST].join(', ')}`);
    logger.info('서버 시작이 성공적으로 완료되었습니다');
});