const swaggerInfo = {
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
                - 일반 API: 1분에 실패 요청 300회 (성공 응답 제외)
                - 관리자 API: 1분에 100회
                - 로그인 API: 15분에 로그인 실패 5회 (성공 응답 제외)
                - 문의 API: 15분에 5회

                ## API 태그
                ### 공개 API
                - **Blog**: 공개 블로그 글 조회 및 조회수 증가
                - **Projects**: 공개 프로젝트 조회 및 조회수 증가
                - **Profile**: 공개 프로필 조회
                - **Social**: 공개 소셜 링크 조회
                - **Skills**: 공개 기술 스택 조회
                - **Tags**: 공개 태그 조회
                - **Experiences**: 공개 경력 및 타임라인 조회
                - **Interests**: 공개 관심사 조회
                - **Contact**: 문의 메시지 접수
                - **Settings**: 공개 사이트 설정 조회
                - **Health**: 서비스 상태 확인
                ### 시스템 모니터링
                - **Monitoring**: 관리자 인증이 필요한 시스템 모니터링 및 캐시 제어
                ### 관리자 API
                - **Admin - Auth**: 관리자 로그인/로그아웃 및 토큰 관리
                - **Admin - Profile**: 관리자 계정 정보 및 비밀번호 관리
                - **Admin - Dashboard**: 관리자 대시보드 통계 조회
                - **Admin - Users**: 관리자 계정 및 권한 관리
                - **Admin - Projects**: 프로젝트 관리
                - **Admin - Blog**: 블로그 콘텐츠 관리
                - **Admin - AI**: AI 지원 기능
                - **Admin - Contacts**: 문의 메시지 관리
                - **Admin - Tags**: 태그 관리
                - **Admin - Skills**: 기술 스택 및 카테고리 관리
                - **Admin - Files**: 파일 업로드 및 삭제
                - **Admin - Settings**: 사이트 설정 관리
                - **Admin - Logs**: 관리자 활동 로그 및 통계
                - **Admin - Experiences**: 경력 및 활동 관리
                - **Admin - Interests**: 관심사 관리
            `.split("\n").map(line => line.trim()).join("\n").trim(),
    contact: {
        name: "GitHub Issues",
        url: "https://github.com/seungwoo505/Portfolio2/issues"
    },
    license: {
        name: "MIT",
        url: "https://opensource.org/licenses/MIT"
    }
};

const swaggerComponents = {
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
                total: {
                    description: "전체 개수. DB COUNT 값은 숫자 문자열로 반환될 수 있습니다.",
                    oneOf: [{ type: "integer", minimum: 0 }, { type: "string", pattern: "^[0-9]+$" }],
                    example: "42"
                },
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
                message: {
                    type: "string",
                    example: "에러 메시지"
                },
                error: {
                    type: "string",
                    example: "에러 메시지",
                    deprecated: true
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
        LoginRequest: {
            type: "object",
            required: [
                "username",
                "password"
            ],
            properties: {
                username: {
                    type: "string",
                    example: "admin"
                },
                password: {
                    type: "string",
                    example: "StrongAdminPass!2026"
                }
            }
        },
        LoginResponse: {
            type: "object",
            required: ["success", "message", "data"],
            properties: {
                success: {
                    type: "boolean",
                    example: true
                },
                message: { type: "string", example: "로그인되었습니다." },
                data: {
                    type: "object",
                    required: ["token", "refreshToken", "user", "permissions"],
                    properties: {
                        token: { type: "string", description: "액세스 토큰", example: "eyJhbGciOiJIUzI1NiIs..." },
                        refreshToken: { type: "string", description: "갱신 토큰", example: "eyJhbGciOiJIUzI1NiIs..." },
                        user: {
                            type: "object",
                            description: "password_hash를 제외한 관리자 정보",
                            required: ["id", "username", "role"],
                            properties: {
                                id: { type: "integer", example: 1 },
                                username: { type: "string", example: "admin" },
                                email: { type: "string", format: "email" },
                                full_name: { type: "string", nullable: true },
                                role: { type: "string", enum: ["super_admin", "admin", "editor"] }
                            }
                        },
                        permissions: {
                            type: "array",
                            description: "역할 권한과 직접 부여 권한을 합친 목록",
                            items: {
                                type: "object",
                                properties: {
                                    name: { type: "string", example: "dashboard.read" },
                                    resource: { type: "string", example: "dashboard" },
                                    action: { type: "string", example: "read" },
                                    description: { type: "string", nullable: true }
                                }
                            }
                        }
                    }
                }
            }
        },
        DashboardStats: {
            type: "object",
            properties: {
                blogPosts: {
                    type: "object",
                    properties: {
                        total: {
                            type: "integer",
                            example: 25
                        },
                        published: {
                            type: "integer",
                            example: 20
                        },
                        drafts: {
                            type: "integer",
                            example: 5
                        }
                    }
                },
                projects: {
                    type: "object",
                    properties: {
                        total: {
                            type: "integer",
                            example: 12
                        },
                        featured: {
                            type: "integer",
                            example: 8
                        }
                    }
                },
                contactMessages: {
                    type: "integer",
                    example: 45
                },
                adminActivity: {
                    type: "integer",
                    example: 156
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
                    description: "응답 데이터. API에 따라 객체, 배열, 원시값 또는 null을 반환합니다."
                },
                message: { type: "string", description: "처리 결과 메시지" }
            }
        }
    }
};

module.exports = {
    swaggerComponents,
    swaggerInfo
};
