const swaggerTags = [
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
];

const swaggerTagGroups = [
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
];

module.exports = {
    swaggerTagGroups,
    swaggerTags
};
