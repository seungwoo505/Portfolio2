const swaggerUi = require("swagger-ui-express");
const swaggerJsdoc = require("swagger-jsdoc");

const normalizeServerUrl = (url) => {
    if (!url) return url;
    return url.replace(/\/+$/, "").replace(/\/api$/i, "");
};

const createSwaggerSpec = ({ port }) => {
    const productionServerUrl = normalizeServerUrl(process.env.MY_HOST || `http://localhost:${port}`);
    const developmentServerUrl = normalizeServerUrl(`http://localhost:${port}`);

    return swaggerJsdoc({
        definition: {
            openapi: "3.0.0",
            info: {
                title: "Portfolio API",
                version: "2.1.0",
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
                - 문의 API: 15분에 5회

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
                    name: "GitHub Issues",
                    url: "https://github.com/seungwoo505/Portfolio2/issues"
                },
                license: {
                    name: "MIT",
                    url: "https://opensource.org/licenses/MIT"
                }
            },
            servers: [
                {
                    url: productionServerUrl,
                    description: "Production Server"
                },
                {
                    url: developmentServerUrl,
                    description: "Development Server"
                }
            ],
            components: {
                securitySchemes: {
                    bearerAuth: {
                        type: "http",
                        scheme: "bearer",
                        bearerFormat: "JWT",
                        description: "JWT 토큰을 사용한 인증"
                    }
                },
                schemas: {
                    PaginationMeta: {
                        type: "object",
                        properties: {
                            page: { type: "integer", example: 1 },
                            limit: { type: "integer", example: 10 },
                            total: { type: "integer", example: 42 },
                            totalPages: { type: "integer", example: 5 }
                        }
                    },
                    Error: {
                        type: "object",
                        properties: {
                            success: {
                                type: "boolean",
                                example: false
                            },
                            error: {
                                type: "string",
                                example: "에러 메시지"
                            }
                        }
                    },
                    ErrorResponse: {
                        type: "object",
                        properties: {
                            success: {
                                type: "boolean",
                                example: false
                            },
                            message: {
                                type: "string",
                                example: "에러 메시지"
                            }
                        }
                    },
                    Success: {
                        type: "object",
                        properties: {
                            success: {
                                type: "boolean",
                                example: true
                            },
                            data: {
                                type: "object",
                                description: "응답 데이터"
                            }
                        }
                    }
                }
            },
            tags: [
                {
                    name: "Public",
                    description: "인증 없이 사용하는 공개 API"
                },
                {
                    name: "Blog",
                    description: "블로그 포스트 관련 API"
                },
                {
                    name: "Projects",
                    description: "프로젝트 포트폴리오 관련 API"
                },
                {
                    name: "Profile",
                    description: "개인 프로필 정보"
                },
                {
                    name: "Social",
                    description: "소셜 링크 및 외부 프로필"
                },
                {
                    name: "Skills",
                    description: "기술 스택 및 카테고리"
                },
                {
                    name: "Tags",
                    description: "태그 관리 및 조회"
                },
                {
                    name: "Experiences",
                    description: "경력 및 활동"
                },
                {
                    name: "Contact",
                    description: "연락처 메시지 관리"
                },
                {
                    name: "Settings",
                    description: "사이트 설정 관련 API"
                },
                {
                    name: "Health",
                    description: "서비스 상태 및 헬스 체크"
                },
                {
                    name: "Monitoring",
                    description: "시스템 모니터링 및 캐시 제어"
                },
                {
                    name: "Admin - Auth",
                    description: "관리자 로그인/로그아웃 및 토큰 관리"
                },
                {
                    name: "Admin - Profile",
                    description: "관리자 계정 정보 및 비밀번호 관리"
                },
                {
                    name: "Admin - Dashboard",
                    description: "관리자 대시보드 통계 조회"
                },
                {
                    name: "Admin - Users",
                    description: "관리자 계정 및 권한 관리"
                },
                {
                    name: "Admin - Projects",
                    description: "관리자 프로젝트 관리"
                },
                {
                    name: "Admin - Blog",
                    description: "관리자 블로그 콘텐츠 관리"
                },
                {
                    name: "Admin - AI",
                    description: "관리자용 AI 도구"
                },
                {
                    name: "Admin - Contacts",
                    description: "문의 메시지 관리"
                },
                {
                    name: "Admin - Tags",
                    description: "태그 생성 및 관리"
                },
                {
                    name: "Admin - Skills",
                    description: "기술 스택 및 카테고리 관리"
                },
                {
                    name: "Admin - Files",
                    description: "파일 업로드 및 삭제"
                },
                {
                    name: "Admin - Settings",
                    description: "사이트 설정 관리"
                },
                {
                    name: "Admin - Logs",
                    description: "관리자 활동 로그 및 통계"
                }
            ],
            "x-tagGroups": [
                {
                    name: "공개 API",
                    tags: [
                        "Public",
                        "Blog",
                        "Projects",
                        "Profile",
                        "Social",
                        "Skills",
                        "Tags",
                        "Experiences",
                        "Contact",
                        "Settings",
                        "Health",
                        "Monitoring"
                    ]
                },
                {
                    name: "관리자 API",
                    tags: [
                        "Admin - Auth",
                        "Admin - Profile",
                        "Admin - Dashboard",
                        "Admin - Users",
                        "Admin - Projects",
                        "Admin - Blog",
                        "Admin - AI",
                        "Admin - Contacts",
                        "Admin - Tags",
                        "Admin - Skills",
                        "Admin - Files",
                        "Admin - Settings",
                        "Admin - Logs"
                    ]
                }
            ]
        },
        apis: [
            "./routes/*.js",
            "./routes/admin/*.js"
        ]
    });
};

const swaggerUiOptions = {
    swaggerOptions: {
        docExpansion: "none",
        filter: true,
        tryItOutEnabled: true,
        supportedSubmitMethods: ["get", "post", "put", "delete", "patch"],
        validatorUrl: null,
        url: "/api-docs.json",
        deepLinking: true,
        displayOperationId: false,
        defaultModelsExpandDepth: 1,
        defaultModelExpandDepth: 1,
        showExtensions: false,
        showCommonExtensions: false
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

const mountSwaggerDocs = (app, { port }) => {
    const swaggerSpec = createSwaggerSpec({ port });
    app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(swaggerSpec, swaggerUiOptions));
    app.get("/api-docs.json", (req, res) => res.json(swaggerSpec));
};

module.exports = {
    createSwaggerSpec,
    mountSwaggerDocs,
    normalizeServerUrl,
    swaggerUiOptions
};
