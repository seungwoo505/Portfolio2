#  관리자 시스템 가이드

완전한 관리자 인증 및 권한 관리 시스템이 구현되었습니다.

##  **관리자 시스템 구조**

###  **데이터베이스 테이블**

- `admin_users` - 관리자 계정 관리
- `admin_sessions` - JWT 세션 관리
- `admin_activity_logs` - 모든 관리자 활동 로그
- `admin_permissions` - 세분화된 권한 정의
- `admin_role_permissions` - 역할별 권한 할당
- `admin_user_permissions` - 관리자별 권한 할당

###  **관리자 역할 (Role)**

- **`super_admin`** - 모든 권한 (관리자 계정 관리 포함)
- **`admin`** - 일반 관리 권한 (컨텐츠 관리)
- **`editor`** - 편집 권한만 (블로그/프로젝트 수정)

###  **권한 시스템**

세분화된 권한으로 각 기능별 접근 제어:

#### 블로그 권한

- `blog.create` - 블로그 포스트 생성
- `blog.read` - 블로그 포스트 조회 (비공개 포함)
- `blog.update` - 블로그 포스트 수정
- `blog.edit` - 블로그 포스트 편집 기능
- `blog.delete` - 블로그 포스트 삭제
- `blog.publish` - 블로그 포스트 발행/발행취소

#### 프로젝트 권한

- `projects.create` - 프로젝트 생성
- `projects.read` - 프로젝트 조회
- `projects.update` - 프로젝트 수정
- `projects.delete` - 프로젝트 삭제

#### 기타 권한

- `contacts.read` - 연락처 메시지 조회
- `contacts.update` - 연락처 메시지 상태 변경
- `settings.read` - 사이트 설정 조회
- `settings.update` - 사이트 설정 수정
- `dashboard.read` - 대시보드 접근
- `logs.read` - 관리자 활동 로그 조회
- `files.create` - 업로드 파일 생성
- `files.delete` - 업로드 파일 삭제
- `personal_info.read` - 개인 정보 조회
- `personal_info.update` - 개인 정보 수정
- `social_links.read` - 소셜 링크 조회
- `social_links.create` - 소셜 링크 생성
- `social_links.update` - 소셜 링크 수정
- `social_links.delete` - 소셜 링크 삭제
- `experiences.read/create/update/delete` - 경력 조회/생성/수정/삭제
- `interests.read/create/update/delete` - 관심사 조회/생성/수정/삭제

##  **API 엔드포인트**

###  **인증 관련**

```bash
# 관리자 로그인
POST /api/admin/login
{
    "username": "<관리자 사용자명>",
    "password": "<관리자 비밀번호>"
}

# 로그아웃
POST /api/admin/logout
# Headers: Authorization: Bearer <token>

# 액세스 토큰 재발급
POST /api/admin/refresh
{
    "refreshToken": "<refresh-token>"
}

# 내 정보 조회
GET /api/admin/me
# Headers: Authorization: Bearer <token>

# 비밀번호 변경
PUT /api/admin/password
{
    "oldPassword": "current_password",
    "newPassword": "new_password"
}
```

###  **관리자 계정 관리 (super_admin 전용)**

```bash
# 모든 관리자 조회
GET /api/admin/users

# 새 관리자 생성
POST /api/admin/users
{
    "username": "newadmin",
    "email": "admin@example.com",
    "password": "password123",
    "full_name": "관리자 이름",
    "role": "admin"
}

# 관리자 정보 수정
PUT /api/admin/users/:id
{
    "full_name": "수정된 이름",
    "role": "editor",
    "is_active": true
}
```

###  **대시보드 및 통계**

```bash
# 대시보드 메인 통계
GET /api/admin/dashboard

# 활동 로그 조회
GET /api/admin/logs?limit=50&page=1

# 활동 통계
GET /api/admin/logs/stats?days=30
```

###  **블로그 관리**

```bash
# 모든 포스트 조회 (비공개 포함)
GET /api/admin/blog/posts?limit=20&page=1

# 포스트 상세 조회
GET /api/admin/blog/posts/slug/:slug

# 포스트 수정
PUT /api/admin/blog/posts/slug/:slug

# 포스트 발행/발행취소
PUT /api/admin/blog/posts/slug/:slug/publish
{
    "is_published": true
}

# 포스트 추천/추천해제
PUT /api/admin/blog/posts/slug/:slug/featured
{
    "is_featured": true
}

# 포스트 삭제
DELETE /api/admin/blog/posts/slug/:slug
```

###  **프로필 및 소셜 링크 관리**

```bash
# 개인 정보 조회
GET /api/admin/personal-info

# 개인 정보 수정
PUT /api/admin/personal-info

# 소셜 링크 조회
GET /api/admin/social-links

# 소셜 링크 생성
POST /api/admin/social-links

# 소셜 링크 수정
PUT /api/admin/social-links/:id

# 소셜 링크 삭제
DELETE /api/admin/social-links/:id
```

###  **연락처 관리**

```bash
# 모든 메시지 조회
GET /api/admin/contacts?limit=50&unread=true

# 메시지 읽음 처리
PUT /api/admin/contacts/:id/read
```

###  **사이트 설정**

```bash
# 모든 설정 조회
GET /api/admin/settings

# 설정 업데이트
PUT /api/admin/settings
{
    "settings": {
        "site_title": {
            "value": "새 사이트 제목",
            "type": "string",
            "is_public": true
        }
    }
}
```

##  **보안 기능**

### **1. JWT 토큰 인증**

- Access Token 30분 만료, Refresh Token 12시간 만료
- `admin_sessions`에 세션 ID와 리프레시 토큰 해시 저장
- 모든 관리자 요청에서 JWT 서명, 발급 IP, 서버 저장 세션 상태를 함께 검증
- 로그아웃 시 세션의 `revoked_at`을 기록해 이후 토큰 사용 차단

### **2. 계정 보안**

- bcryptjs 패스워드 해싱 (네이티브 의존성 없음)
- 로그인 실패 횟수 제한 (5회 실패 시 30분 잠금)
- IP 주소 기반 로그인 추적

### **3. 활동 로그**

- 모든 관리자 활동 자동 기록
- IP 주소, User-Agent 정보 저장
- 상세한 액션 및 리소스 정보

### **4. 권한 기반 접근 제어**

- 세분화된 권한 시스템
- 역할 기반 접근 제어
- 미들웨어를 통한 자동 권한 검증

##  **사용법**

### **1. 서버 설정**

환경 변수에 JWT 시크릿과 초기 관리자 계정 정보를 설정합니다:

```env
JWT_SECRET=your-super-secret-jwt-key-here
JWT_REFRESH_SECRET=your-super-secret-refresh-key-here
ADMIN_BOOTSTRAP_USERNAME=admin
ADMIN_BOOTSTRAP_EMAIL=admin@example.com
ADMIN_BOOTSTRAP_PASSWORD=strong-random-bootstrap-password
```

### **2. 데이터베이스 초기화**

마이그레이션으로 관리자 테이블과 기본 권한을 생성합니다:

```bash
npm run migrate

# 서버 코드에서 사용하는 권한명과 역할 매핑 동기화
mysql -u user -p portfolio_db < migrations/manual/sync-admin-permissions.sql
```

### **3. 의존성 설치**

```bash
npm install bcryptjs jsonwebtoken
```

### **4. 초기 관리자 계정**

초기 `super_admin` 계정은 마이그레이션 실행 시 `ADMIN_BOOTSTRAP_USERNAME`, `ADMIN_BOOTSTRAP_EMAIL`, `ADMIN_BOOTSTRAP_PASSWORD` 환경 변수로 생성됩니다.

- 기본 계정/기본 비밀번호는 제공하지 않습니다.
- `ADMIN_BOOTSTRAP_PASSWORD`는 운영에서 추측 불가능한 12자 이상의 값으로 설정해야 합니다.
- 운영 서버 최초 로그인 후 비밀번호를 다시 변경하고, 불필요한 bootstrap 환경 변수는 제거하는 것을 권장합니다.

##  **프론트엔드 연동**

### **Next.js 관리자 페이지 예시**

```javascript
// pages/admin/login.js
import { useState } from "react";
import { useRouter } from "next/router";

export default function AdminLogin() {
  const [credentials, setCredentials] = useState({
    username: "",
    password: "",
  });
  const router = useRouter();

  const handleLogin = async (e) => {
    e.preventDefault();

    try {
      const response = await fetch("/api/admin/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(credentials),
      });

      const result = await response.json();

      if (result.success) {
        // 토큰 저장
        localStorage.setItem("admin_token", result.data.token);
        router.push("/admin/dashboard");
      } else {
        alert(result.message);
      }
    } catch (error) {
      console.error("Login error:", error);
    }
  };

  return (
    <form onSubmit={handleLogin}>
      <input
        type="text"
        placeholder="사용자명"
        value={credentials.username}
        onChange={(e) =>
          setCredentials({ ...credentials, username: e.target.value })
        }
      />
      <input
        type="password"
        placeholder="비밀번호"
        value={credentials.password}
        onChange={(e) =>
          setCredentials({ ...credentials, password: e.target.value })
        }
      />
      <button type="submit">로그인</button>
    </form>
  );
}
```

### **API 호출 헬퍼**

```javascript
// lib/admin-api.js
const API_BASE =
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001/api/admin";

const getAuthHeader = () => {
  const token = localStorage.getItem("admin_token");
  return token ? { Authorization: `Bearer ${token}` } : {};
};

export const adminApi = {
  // 인증
  login: (credentials) =>
    fetch(`${API_BASE}/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(credentials),
    }).then((r) => r.json()),

  logout: () =>
    fetch(`${API_BASE}/logout`, {
      method: "POST",
      headers: getAuthHeader(),
    }).then((r) => r.json()),

  // 대시보드
  getDashboard: () =>
    fetch(`${API_BASE}/dashboard`, {
      headers: getAuthHeader(),
    }).then((r) => r.json()),

  // 블로그 관리
  getBlogPosts: (params = {}) => {
    const query = new URLSearchParams(params);
    return fetch(`${API_BASE}/blog/posts?${query}`, {
      headers: getAuthHeader(),
    }).then((r) => r.json());
  },

  publishPost: (postId, isPublished) =>
    fetch(`${API_BASE}/blog/posts/${postId}/publish`, {
      method: "PUT",
      headers: { ...getAuthHeader(), "Content-Type": "application/json" },
      body: JSON.stringify({ is_published: isPublished }),
    }).then((r) => r.json()),

  // 연락처 관리
  getContacts: (params = {}) => {
    const query = new URLSearchParams(params);
    return fetch(`${API_BASE}/contacts?${query}`, {
      headers: getAuthHeader(),
    }).then((r) => r.json());
  },

  markContactRead: (contactId) =>
    fetch(`${API_BASE}/contacts/${contactId}/read`, {
      method: "PUT",
      headers: getAuthHeader(),
    }).then((r) => r.json()),
};
```

##  **모니터링 및 로그**

### **활동 로그 분석**

- 일별/주별/월별 활동 통계
- 관리자별 활동 내역
- 리소스별 접근 패턴
- 실패한 로그인 시도 추적

### **보안 모니터링**

- 비정상적인 로그인 패턴 감지
- 권한 오남용 탐지
- 계정 잠금 알림

##  **확장 가능성**

이 시스템은 다음과 같이 확장할 수 있습니다:

1. **2FA 인증** - Google Authenticator 연동
2. **IP 화이트리스트** - 특정 IP에서만 접근 허용
3. **세션 관리** - 동시 로그인 제한
4. **알림 시스템** - 중요 활동 시 이메일/Slack 알림
5. **API Rate Limiting** - 관리자별 요청 제한

이 관리자 시스템으로 포트폴리오 사이트의 모든 컨텐츠를 안전하고 효율적으로 관리할 수 있습니다! 
