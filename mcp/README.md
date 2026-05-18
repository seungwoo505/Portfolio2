# Portfolio MCP Server

포트폴리오 백엔드 공개 API를 읽기 전용 MCP 도구로 노출하는 stdio 서버입니다.

## 실행 조건

- Node.js 18 이상
- `portfolio-server` API가 실행 중이어야 합니다.
- 기본 API 주소는 `http://localhost:3001/api`입니다.

## 실행

```bash
cd portfolio-server/mcp
npm start
```

다른 API 주소를 쓰려면 환경 변수를 지정합니다.

```bash
PORTFOLIO_API_BASE_URL=https://example.com/api npm start
```

## 제공 도구

- `get_profile`: 공개 프로필 정보 조회
- `list_projects`: 공개 프로젝트 목록 조회
- `get_project`: slug 기반 프로젝트 상세 조회
- `list_blog_posts`: 공개 블로그 글 목록 조회
- `get_blog_post`: slug 기반 블로그 글 상세 조회
- `list_skills`: 기술 스택 조회
- `list_experiences`: 경력/타임라인 조회
- `list_interests`: 관심사 조회

## Codex/Claude Desktop 연결 예시

```json
{
  "mcpServers": {
    "portfolio": {
      "command": "node",
      "args": [
        "/Users/seungwoo/Portfolio2/portfolio-server/mcp/src/server.js"
      ],
      "env": {
        "PORTFOLIO_API_BASE_URL": "http://localhost:3001/api"
      }
    }
  }
}
```

## 검증

```bash
npm run check
npm run smoke
```

`smoke`는 실제 API를 호출하지 않고 MCP 초기화와 도구 목록 응답만 검증합니다.
