# 🚀 Portfolio Project

![Portfolio Preview](./portfolio-next/public/images/portfolio-preview.png)

**Next.js + Express.js 풀스택 포트폴리오 웹사이트**

개인 포트폴리오를 위한 현대적인 풀스택 웹 애플리케이션입니다.

🌐 **라이브 사이트**: [https://seungwoo.i234.me](https://seungwoo.i234.me) | 📚 **API 문서**: [https://seungwoo.i234.me:3333/api-docs](https://seungwoo.i234.me:3333/api-docs)

## 📋 목차

- [프로젝트 개요](#-프로젝트-개요)
- [기술 스택](#-기술-스택)
- [빠른 시작](#-빠른-시작)
- [프로젝트 구조](#-프로젝트-구조)
- [주요 기능](#-주요-기능)
- [배포](#-배포)
- [문서](#-문서)

## 🎯 프로젝트 개요

개인 포트폴리오를 위한 완전한 풀스택 웹 애플리케이션입니다.

- **Frontend**: Next.js 15 + TypeScript + Tailwind CSS
- **Backend**: Express.js + MariaDB + JWT 인증
- **Features**: 블로그, 프로젝트 포트폴리오, 관리자 대시보드
- **Deployment**: 정적 사이트 생성 + API 서버
- **Live Demo**: [https://seungwoo.i234.me](https://seungwoo.i234.me)

## 🛠 기술 스택

### Frontend

- **Next.js 15** - React 기반 프레임워크
- **TypeScript** - 타입 안전성
- **Tailwind CSS** - 유틸리티 우선 CSS
- **Framer Motion** - 애니메이션
- **GitHub Repo**: [seungwoo505/portfolio-next](https://github.com/seungwoo505/portfolio-next) (프론트엔드 원격 저장소)

### Backend

- **Express.js** - Node.js 웹 프레임워크
- **MariaDB** - 관계형 데이터베이스
- **JWT** - 인증 시스템
- **Winston** - 로깅

## 🚀 빠른 시작

### 1. 저장소 클론

```bash
git clone <repository-url>
cd Portfolio2
```

### 2. 백엔드 실행

```bash
cd portfolio-server
npm install
cp .env.example .env  # 환경 변수 설정
npm run dev
```

### 3. 프론트엔드 실행

```bash
cd ../portfolio-next
npm install
cp .env.example .env.local  # API URL 설정
npm run dev
```

### 4. 접속

- **프론트엔드**: http://localhost:3000 (개발) / https://seungwoo.i234.me (프로덕션)
- **백엔드 API**: https://localhost:3001/api (개발) / https://seungwoo.i234.me:3333/api (프로덕션)
- **API 문서**: https://localhost:3001/api-docs (개발) / https://seungwoo.i234.me:3333/api-docs (프로덕션)

## 📁 프로젝트 구조

![Architecture](./portfolio-next/public/images/architecture.png)

```
Portfolio2/
├── portfolio-next/     # Next.js 프론트엔드
│   ├── src/
│   │   ├── app/        # 페이지
│   │   ├── components/ # 컴포넌트
│   │   ├── hooks/      # Custom Hooks
│   │   └── lib/        # 유틸리티
│   └── package.json
│
├── portfolio-server/   # Express.js 백엔드
│   ├── models/         # 데이터베이스 모델
│   ├── routes/         # API 라우트
│   ├── utils/          # 유틸리티
│   └── server.js       # 메인 서버
│
└── README.md          # 이 파일
```

## ✨ 주요 기능

![Homepage](./portfolio-next/public/images/homepage.png) ![Admin Dashboard](./portfolio-next/public/images/admin-dashboard.png)

### 🏠 포트폴리오

- 반응형 홈페이지
- 프로젝트 갤러리
- 기술 스택 표시
- 개인 정보 및 소셜 링크

### 📝 블로그

- 블로그 포스트 관리
- 마크다운 지원
- 태그 기반 분류
- 검색 기능

### 🔐 관리자

- JWT 인증
- 대시보드
- 컨텐츠 관리
- 활동 로그

### 📧 연락처

- 연락처 폼
- 메시지 관리
- 이메일 알림

## 🚀 배포

### 프론트엔드 (정적 사이트)

```bash
cd portfolio-next
npm run build
# out/ 디렉토리를 웹 서버에 업로드
```

### 백엔드 (API 서버)

```bash
cd portfolio-server
npm install -g pm2
pm2 start server.js
```

## 📚 문서

### 상세 문서

- [🎨 프론트엔드 문서](./portfolio-next/README.md)
- [🔧 백엔드 문서](./portfolio-server/README.md)
- [🔐 관리자 가이드](./portfolio-server/ADMIN_GUIDE.md)
- [🚀 배포 가이드](./portfolio-server/DEPLOYMENT_GUIDE.md)

### API 문서

- **Swagger UI**: https://localhost:3001/api-docs (개발) / https://seungwoo.i234.me:3333/api-docs (프로덕션)
- **API 엔드포인트**:
  - `GET /api/personal-info` - 개인 정보
  - `GET /api/projects` - 프로젝트 목록
  - `GET /api/blog/posts` - 블로그 포스트
  - `POST /api/contact` - 연락처 메시지
