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
};

module.exports = {
    swaggerComponents,
    swaggerInfo
};
