# 포트폴리오 서버 데이터베이스 설계

## 📊 데이터베이스 구조

이 포트폴리오 서버는 MariaDB/MySQL을 사용하여 다음과 같은 데이터를 관리합니다:

### 🏠 개인 정보 (personal_info)

- 이름, 직책, 자기소개
- 연락처 정보 (이메일, 전화번호, 위치)
- 프로필 이미지, 이력서 URL

### 🔗 소셜 링크 (social_links)

- GitHub, LinkedIn, Twitter 등 소셜 미디어 링크
- 플랫폼별 아이콘 및 표시 순서 관리

### 💪 스킬 관리

- **skill_categories**: 스킬 카테고리 (Frontend, Backend, Database 등)
- **skills**: 개별 스킬 정보 (숙련도, 경험년수, 아이콘 등)

### 🚀 프로젝트 관리

- **projects**: 프로젝트 기본 정보 (제목, 설명, URL, 상태 등)
- **project_images**: 프로젝트 이미지 갤러리
- **project_skills**: 프로젝트에 사용된 기술 스택 연결

### 📝 블로그 시스템

- **blog_posts**: 블로그 포스트 (제목, 내용, 메타데이터)
- **blog_tags**: 태그 시스템
- **blog_post_tags**: 포스트-태그 연결 테이블

### 📧 연락처 및 기타

- **contact_messages**: 연락처 폼으로 받은 메시지
- **experiences**: 경력/학력/자격증 정보
- **site_settings**: 사이트 설정 키-값 저장
- **visitor_stats**: 방문자 통계 (선택사항)

## 🛠 설치 및 설정

### 1. 의존성 설치

```bash
npm install
```

### 2. 환경 변수 설정

`.env` 파일을 생성하고 다음 내용을 설정하세요:

```env
# 데이터베이스 설정
DB_HOST=localhost
DB_PORT=3306
DB_USER=your_username
DB_PASSWORD=your_password
DB_SCHEMA=portfolio_db

# 서버 설정
PORT=3001
NODE_ENV=development

# HTTPS 인증서 (운영환경)
HTTPS_KEY=/path/to/private-key.pem
HTTPS_CERT=/path/to/certificate.pem
HTTPS_CA=/path/to/ca-bundle.pem

# CORS 설정
LOCALHOST=http://localhost:3000
MY_HOST=https://your-domain.com
```

### 3. 데이터베이스 생성

먼저 MariaDB/MySQL에서 데이터베이스를 생성하세요:

```sql
CREATE DATABASE portfolio_db CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER 'portfolio_user'@'localhost' IDENTIFIED BY 'your_password';
GRANT ALL PRIVILEGES ON portfolio_db.* TO 'portfolio_user'@'localhost';
FLUSH PRIVILEGES;
```

### 4. 테이블 생성 및 초기 데이터 삽입

```bash
npm run setup:db
```

또는 수동으로:

```bash
npm run migrate
```

### 5. 서버 실행

```bash
# 개발 모드
npm run dev

# 프로덕션 모드
npm start
```

## 📡 API 엔드포인트

### 개인 정보

- `GET /api/personal-info` - 개인 정보 조회
- `PUT /api/personal-info` - 개인 정보 수정

### 소셜 링크

- `GET /api/social-links` - 모든 소셜 링크 조회
- `POST /api/social-links` - 소셜 링크 추가

### 스킬

- `GET /api/skills` - 모든 스킬 및 카테고리 조회
- `GET /api/skills/featured` - 주요 스킬만 조회
- `POST /api/skills` - 새 스킬 추가

### 프로젝트

- `GET /api/projects` - 프로젝트 목록 조회
- `GET /api/projects/:id` - 특정 프로젝트 상세 조회
- `POST /api/projects` - 새 프로젝트 생성

### 블로그

- `GET /api/blog/posts` - 블로그 포스트 목록
- `GET /api/blog/posts/:slug` - 특정 포스트 조회
- `GET /api/blog/search?q=검색어` - 포스트 검색
- `POST /api/blog/posts` - 새 포스트 생성

### 연락처

- `POST /api/contact` - 연락처 메시지 전송

### 설정

- `GET /api/settings` - 공개 사이트 설정 조회

### 헬스체크

- `GET /api/health` - 서버 및 DB 상태 확인

## 🔧 사용법 예시

### Next.js에서 데이터 가져오기

```javascript
// pages/index.js - 홈페이지
export async function getStaticProps() {
  const [personalInfo, featuredSkills, featuredProjects] = await Promise.all([
    fetch(`${process.env.API_URL}/api/personal-info`).then((r) => r.json()),
    fetch(`${process.env.API_URL}/api/skills/featured`).then((r) => r.json()),
    fetch(`${process.env.API_URL}/api/projects?featured=true`).then((r) =>
      r.json()
    ),
  ]);

  return {
    props: {
      personalInfo: personalInfo.data,
      featuredSkills: featuredSkills.data,
      featuredProjects: featuredProjects.data,
    },
    revalidate: 3600, // 1시간마다 재생성
  };
}
```

```javascript
// pages/projects/index.js - 프로젝트 목록
export async function getStaticProps() {
  const response = await fetch(`${process.env.API_URL}/api/projects`);
  const { data: projects } = await response.json();

  return {
    props: { projects },
    revalidate: 1800, // 30분마다 재생성
  };
}
```

```javascript
// pages/blog/[slug].js - 개별 블로그 포스트
export async function getStaticPaths() {
  const response = await fetch(`${process.env.API_URL}/api/blog/posts`);
  const { data: posts } = await response.json();

  const paths = posts.map((post) => ({
    params: { slug: post.slug },
  }));

  return { paths, fallback: "blocking" };
}

export async function getStaticProps({ params }) {
  const response = await fetch(
    `${process.env.API_URL}/api/blog/posts/${params.slug}`
  );

  if (!response.ok) {
    return { notFound: true };
  }

  const { data: post } = await response.json();
  return {
    props: { post },
    revalidate: 3600,
  };
}
```

### API 호출 헬퍼 함수

```javascript
// lib/api.js
const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001/api";

export const api = {
  // 개인 정보
  getPersonalInfo: () =>
    fetch(`${API_BASE}/personal-info`).then((r) => r.json()),

  // 프로젝트
  getProjects: (params = {}) => {
    const query = new URLSearchParams(params);
    return fetch(`${API_BASE}/projects?${query}`).then((r) => r.json());
  },

  // 블로그
  getBlogPosts: (params = {}) => {
    const query = new URLSearchParams(params);
    return fetch(`${API_BASE}/blog/posts?${query}`).then((r) => r.json());
  },

  searchBlogPosts: (searchTerm) =>
    fetch(`${API_BASE}/blog/search?q=${encodeURIComponent(searchTerm)}`).then(
      (r) => r.json()
    ),

  // 연락처
  sendContactMessage: (data) =>
    fetch(`${API_BASE}/contact`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    }).then((r) => r.json()),
};
```

## 🚀 배포 시 고려사항

1. **환경 변수**: 운영 환경의 데이터베이스 정보와 HTTPS 인증서 경로 설정
2. **CORS**: 프론트엔드 도메인을 CORS 설정에 추가
3. **보안**: Rate limiting과 helmet 미들웨어가 활성화되어 있음
4. **로깅**: log.js를 통한 로그 관리
5. **데이터베이스**: 커넥션 풀링과 에러 핸들링 구현됨

## 🔄 업데이트 및 마이그레이션

새로운 테이블이나 컬럼 추가 시:

1. `database-schema.sql` 파일 업데이트
2. 새로운 마이그레이션 파일 생성
3. `migrations/` 폴더에 타임스탬프 기반 파일 추가
4. `npm run migrate` 실행

이 구조를 통해 확장 가능하고 유지보수가 쉬운 포트폴리오 서버를 구축할 수 있습니다!
