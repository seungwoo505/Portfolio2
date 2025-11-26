#  관리자 시스템 가이드

완전한 관리자 인증 및 권한 관리 시스템이 구현되었습니다.

##  **관리자 시스템 구조**

###  **데이터베이스 테이블**

- `admin_users` - 관리자 계정 관리
- `admin_sessions` - JWT 세션 관리
- `admin_activity_logs` - 모든 관리자 활동 로그
- `admin_permissions` - 세분화된 권한 정의
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
- `blog.delete` - 블로그 포스트 삭제
- `blog.publish` - 블로그 포스트 발행/발행취소

#### 프로젝트 권한

- `projects.create` - 프로젝트 생성
- `projects.update` - 프로젝트 수정
- `projects.delete` - 프로젝트 삭제

#### 기타 권한

- `contacts.read` - 연락처 메시지 조회
- `settings.update` - 사이트 설정 수정
- `admin.create` - 관리자 계정 관리
- `dashboard.read` - 대시보드 접근

##  **API 엔드포인트**

###  **인증 관련**

```bash
# 관리자 로그인
POST /api/admin/login
{
    "username": "admin",
    "password": "admin123"
}

# 로그아웃
POST /api/admin/logout
# Headers: Authorization: Bearer <token>

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

# 포스트 발행/발행취소
PUT /api/admin/blog/posts/:id/publish
{
    "is_published": true
}
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

- 24시간 만료 토큰
- 토큰 해시화 저장
- 세션 기반 토큰 검증

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

환경 변수에 JWT_SECRET 추가:

```env
JWT_SECRET=your-super-secret-jwt-key-here
```

### **2. 데이터베이스 초기화**

관리자 테이블 생성:

```bash
# database-admin-schema.sql 실행
mysql -u user -p portfolio_db < database-admin-schema.sql
```

### **3. 의존성 설치**

```bash
npm install bcryptjs jsonwebtoken
```

### **4. 기본 관리자 계정**

- **사용자명**: `admin`
- **비밀번호**: `admin123`
- **역할**: `super_admin`

 **보안 주의**: 실제 배포 전에 기본 패스워드를 반드시 변경하세요!

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
