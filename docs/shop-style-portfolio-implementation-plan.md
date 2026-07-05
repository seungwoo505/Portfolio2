# 쇼핑몰형 포트폴리오 구현 기획서

작성일: 2026-07-03  
기반 문서: [쇼핑몰형 포트폴리오 참고 사이트 분석](./shop-mall-reference-analysis.md), [쇼핑몰형 포트폴리오 스키마](./shop-style-portfolio-schema.sql)

## 1. 기획 목적

기존 포트폴리오는 프로젝트를 일반 목록과 상세 페이지로 보여주는 구조다. 이번 개편의 목표는 프로젝트를 쇼핑몰 상품처럼 탐색, 비교, 저장, 상세 확인할 수 있게 만드는 것이다.

단, 실제 커머스 기능을 만드는 것이 목적은 아니다. 결제, 주문, 배송, 재고는 만들지 않는다. 쇼핑몰 UX에서 가져올 것은 다음 4가지다.

- 빠른 탐색: 카테고리, 검색, 필터, 정렬
- 빠른 판단: 카드 안에서 핵심 정보 비교
- 깊은 설득: 상세 페이지에서 문제, 해결, 구현, 성과 제시
- 재방문 편의: 관심 프로젝트, 비교함, 최근 본 프로젝트

## 2. 핵심 컨셉

### 2.1 한 줄 컨셉

프로젝트를 상품처럼 진열하되, 설득 근거는 개발 포트폴리오답게 `문제`, `해결`, `기술 선택`, `성과`, `검증`으로 보여준다.

### 2.2 사용자 관점

방문자는 다음 흐름으로 움직인다.

1. 첫 화면에서 대표 프로젝트와 추천 섹션을 본다.
2. 카테고리나 검색으로 관심 프로젝트를 좁힌다.
3. 카드에서 난이도, 기술, 성과를 빠르게 비교한다.
4. 상세 페이지에서 구현 근거와 결과를 확인한다.
5. 관심 프로젝트나 비교함에 저장해서 다시 본다.

### 2.3 운영자 관점

관리자는 프로젝트를 일반 글처럼 쓰는 것이 아니라, 쇼핑몰 상품 등록처럼 입력한다.

- 기본 정보
- 카탈로그 카드 정보
- 이미지
- 링크
- 성과 지표
- 기술 스택
- 태그
- 상세 섹션
- 노출 섹션

## 3. 참고 쇼핑몰 요소와 변환 기준

| 쇼핑몰 요소 | 실제 쇼핑몰 의미 | 포트폴리오 적용 기능 | 우선순위 |
| --- | --- | --- | --- |
| 상품 카드 | 상품 비교 단위 | 프로젝트 카드 | 1 |
| 카테고리 | 상품군 탐색 | 프로젝트 유형/목적/기술 분류 | 1 |
| 검색 | 원하는 상품 찾기 | 기술, 문제, 성과, 프로젝트명 검색 | 1 |
| BEST | 인기 상품 | 조회수/추천순 프로젝트 | 1 |
| New Arrivals | 신규 상품 | 최근 추가/개선 프로젝트 | 1 |
| Featured | 기획 노출 | 대표 프로젝트 | 1 |
| 가격 | 구매 판단 기준 | 난이도, 작업 규모, 기여도, 임팩트 | 1 |
| 할인/배지 | 주목 요소 | Featured, New, Case Study, High Impact | 2 |
| 리뷰/평점 | 신뢰 근거 | 성과 지표, 테스트 결과, 회고 | 2 |
| 찜 | 나중에 보기 | 관심 프로젝트 | 2 |
| 장바구니 | 구매 후보 | 비교함 | 2 |
| 최근 본 상품 | 재방문 편의 | 최근 본 프로젝트 | 3 |
| 추천 상품 | 추가 탐색 | 관련 프로젝트/관련 글 | 3 |

가져오면 안 되는 요소:

- 실제 가격처럼 보이는 금액
- 할인율, 쿠폰, 배송 문구
- 결제/주문 흐름
- 광고 배너처럼 보이는 과한 프로모션
- 기술 근거 없이 감성 문구만 있는 상품 상세형 페이지

## 4. 현재 구현 상태 요약

### 4.1 백엔드

백엔드는 쇼핑몰형 스키마 반영이 상당 부분 완료되어 있다.

현재 활용 가능한 공개 API:

```http
GET /public/projects/catalog
GET /public/projects/filter-options
GET /public/projects/recommendations
GET /public/projects
GET /public/projects/:slug
GET /public/projects/:slug/related
POST /public/projects/:slug/view
```

현재 지원되는 프로젝트 목록 필터:

- `search`
- `tags`
- `skills`
- `project_type`
- `types`
- `featured`
- `status`: `published`, `draft`, `all`
- `project_status`: `planning`, `in_progress`, `completed`, `on_hold`, `archived`
- `sort`: `catalog_priority`, `created_at`, `published_at`, `title`, `view_count`, `display_order`
- `order`: `asc`, `desc`

현재 DB에서 준비된 핵심 테이블:

- `projects`
- `project_catalog_profiles`
- `project_catalog_sections`
- `project_catalog_section_items`
- `project_metrics`
- `project_links`
- `project_images`
- `project_tags`
- `project_skills`
- `blog_project_links`
- `tags`
- `skills`

### 4.2 프론트엔드

프론트엔드는 기존 프로젝트 목록/상세/관리자 화면이 이미 있다. 다만 새 백엔드 구조를 완전히 반영하려면 타입, API 클라이언트, UI를 업데이트해야 한다.

현재 확인된 주요 파일:

- `portfolio-next/src/types/project.ts`
- `portfolio-next/src/types/admin-pages.ts`
- `portfolio-next/src/lib/public-api.ts`
- `portfolio-next/src/lib/admin-api.ts`
- `portfolio-next/src/app/(site)/projects/page.tsx`
- `portfolio-next/src/app/(site)/projects/[slug]/ProjectDetailClient.tsx`
- `portfolio-next/src/app/admin/projects/components/ProjectAdminForm.tsx`

현재 프론트엔드에서 보이는 차이:

- `Project` 타입에 `catalog`, `metrics`, `links`, `sections`, `project_type`, `difficulty_label`, `impact_summary` 같은 새 필드가 부족하다.
- `public-api.ts`에 `/public/projects/catalog` 호출 함수가 없다.
- 프로젝트 목록은 모든 프로젝트를 가져온 뒤 클라이언트에서 검색/필터/정렬하는 구조다.
- 상세 페이지는 `catalog_summary` 일부 alias를 사용하지만, metrics/links/images/sections를 상세 설득 구조로 충분히 쓰지 않는다.
- 관리자 프로젝트 폼은 아직 일반 프로젝트 입력에 가깝고, 카탈로그/성과/링크/이미지/스킬/섹션 입력이 부족하다.

## 5. 프론트엔드 기획

### 5.1 정보 구조

프론트엔드 화면은 다음 구조로 재편한다.

```text
/
├─ 쇼핑몰형 홈
│  ├─ 검색
│  ├─ 대표 프로젝트
│  ├─ 빠른 카테고리
│  ├─ 추천 프로젝트
│  ├─ 신규 프로젝트
│  ├─ 인기 프로젝트
│  └─ 케이스 스터디
│
├─ /projects
│  ├─ 검색
│  ├─ 필터
│  ├─ 정렬
│  ├─ 프로젝트 카드 그리드
│  └─ 페이지네이션
│
├─ /projects/[slug]
│  ├─ 상품 상세형 상단
│  ├─ 핵심 지표
│  ├─ 문제와 해결
│  ├─ 기술 상세
│  ├─ 이미지/문서/링크
│  └─ 관련 프로젝트
│
├─ /compare
│  └─ 프로젝트 비교함
│
└─ /wishlist
   └─ 관심 프로젝트
```

1차 MVP에서는 `/compare`, `/wishlist`를 별도 페이지로 만들지 않고 로컬 스토리지 기반 drawer 또는 modal로 처리해도 된다.

### 5.2 홈 화면

참고 요소:

- 쿠팡: 빠른 검색, 카테고리, 오늘의 발견
- 29CM: Showcase, BEST
- Nike: Featured, Trending, New Arrivals
- Etsy: 관심사 기반 점프

적용 방식:

- `/public/projects/catalog`를 호출해서 섹션 단위로 렌더링한다.
- 섹션 순서는 DB의 `project_catalog_sections.display_order`를 따른다.
- 섹션 아이템은 `ProjectCatalogCard` 컴포넌트로 통일한다.
- 첫 화면은 마케팅 hero보다 카탈로그 탐색 경험을 우선한다.

필요 컴포넌트:

- `CatalogHome`
- `CatalogSearchBar`
- `CatalogSection`
- `ProjectCatalogCard`
- `QuickCategoryRail`
- `ProjectActionButtons`

데이터 흐름:

```text
page.tsx
-> projectApi.getCatalog({ limit: 4 })
-> sections[]
-> CatalogSection
-> ProjectCatalogCard
```

### 5.3 프로젝트 카드

카드는 쇼핑몰 상품 카드처럼 반복 가능한 단위로 만든다.

카드 필수 필드:

- `catalog.title`
- `catalog.summary`
- `catalog.label`
- `catalog.status`
- `catalog.badge`
- `catalog.image_url`
- `catalog.price_label`
- `catalog.difficulty_label`
- `catalog.impact_summary`
- `catalog.primary_metric`
- `skills`
- `tags`
- `demo_url`
- `github_url`
- `slug`

카드 UI 원칙:

- 카드 안 설명은 2~3줄까지만 노출한다.
- 기술 스택은 최대 4개만 보이고 나머지는 `+N`으로 처리한다.
- CTA는 `상세 보기`를 기본으로 하고, demo/github는 아이콘 버튼으로 분리한다.
- 가격처럼 보이는 금액은 쓰지 않는다.
- `price_label`은 `High Impact`, `Production Ready`, `Case Study` 같은 판단 라벨로 쓴다.

### 5.4 프로젝트 목록

현재 `/projects/page.tsx`는 프로젝트 전체를 가져와 클라이언트에서 검색/필터/정렬한다. 쇼핑몰형 목록에서는 백엔드 필터를 적극 사용해야 한다.

변경 방향:

- URL query를 기준으로 목록 상태를 관리한다.
- 검색/필터/정렬 변경 시 `/public/projects`에 query를 보낸다.
- 페이지네이션도 서버 응답의 pagination metadata를 사용한다.
- 초성 검색은 프론트엔드 보조 UX로 유지할 수 있지만, 기본 검색 결과는 백엔드 결과를 기준으로 한다.

예상 URL:

```text
/projects?search=db&project_type=backend&skills=mariadb,express&sort=catalog_priority&order=desc&page=1
```

필터 UI:

- 프로젝트 유형
- 기술 스택
- 태그
- 상태
- Featured
- 정렬

### 5.5 프로젝트 상세

상세 페이지는 상품 상세처럼 상단에서 판단 가능한 정보를 주고, 아래에서 근거를 제공한다.

상단 구성:

- 이미지 갤러리
- 프로젝트명
- 카탈로그 요약
- 배지/상태
- 난이도/임팩트 라벨
- 핵심 성과 metric
- 주요 CTA: 상세 보기, 데모, GitHub, 문서

본문 구성:

- 문제
- 해결 방향
- 구현 상세
- 기술 선택 이유
- 성과 지표
- 테스트/검증
- 회고
- 관련 프로젝트

DB 매핑:

| 상세 영역 | 백엔드 필드 |
| --- | --- |
| 상단 제목 | `catalog.title`, `title` |
| 상단 요약 | `catalog.summary`, `summary`, `description` |
| 이미지 | `images`, `catalog.image_url` |
| CTA | `links`, `demo_url`, `github_url` |
| 핵심 지표 | `metrics`, `catalog.primary_metric` |
| 기술 | `skills` |
| 주제 | `tags` |
| 본문 | `content_html`, `content_json`, `content_text`, `sections` |

### 5.6 관심 프로젝트와 비교함

1차 구현은 백엔드 없이 프론트 로컬 스토리지로 처리한다.

로컬 스토리지 key:

```text
portfolio:wishlist
portfolio:compare
portfolio:recent-projects
```

비교함에 담을 최소 데이터:

- `id`
- `slug`
- `catalog.title`
- `catalog.summary`
- `project_type`
- `difficulty_label`
- `impact_summary`
- `skills`
- `demo_url`
- `github_url`

제한:

- 비교함은 최대 4개
- 최근 본 프로젝트는 최대 8개
- 관심 프로젝트는 제한 없음

백엔드 저장은 로그인 사용자 기능이 없으므로 이번 단계에서는 제외한다.

### 5.7 프론트엔드 작업 목록

1차 작업:

- `Project` 타입을 새 백엔드 응답에 맞게 확장한다.
- `projectApi.getCatalog`를 추가한다.
- `ProjectCatalogCard`를 만든다.
- `/projects` 목록을 쇼핑몰형 카드 그리드로 개편한다.
- `/projects/[slug]` 상세를 catalog/metrics/links/images 중심으로 개편한다.

2차 작업:

- URL query 기반 필터/정렬을 붙인다.
- 로컬 스토리지 기반 관심 프로젝트/비교함을 만든다.
- 최근 본 프로젝트를 상세 페이지 진입 시 저장한다.
- 홈 화면에 `/public/projects/catalog` 섹션을 연결한다.

3차 작업:

- 관련 프로젝트 섹션을 추가한다.
- 블로그 글과 프로젝트를 연결한다.
- 프로젝트 비교 페이지를 별도 화면으로 분리한다.

## 6. 백엔드 기획

### 6.1 현재 백엔드에서 바로 쓸 수 있는 부분

현재 백엔드는 쇼핑몰형 포트폴리오의 1차 화면 구현에 필요한 핵심 API가 이미 있다.

바로 사용 가능:

- 카탈로그 홈: `GET /public/projects/catalog`
- 목록: `GET /public/projects`
- 상세: `GET /public/projects/:slug`
- 조회수: `POST /public/projects/:slug/view`
- 카탈로그 카드 응답 alias: `catalog_*`, `catalog`
- 프로젝트 링크 alias: `demo_url`, `project_url`, `github_url`
- 검색/필터/정렬 query

따라서 프론트엔드 1차 MVP는 백엔드 추가 구현 없이도 시작할 수 있다.

### 6.2 보완하면 좋은 API

현재 구조만으로도 시작은 가능하지만, 쇼핑몰형 운영성을 높이기 위한 아래 API도 백엔드에 반영되었다.

#### 6.2.1 카탈로그 섹션 관리 API

목적: 관리자에서 추천/신규/인기/케이스스터디 섹션을 운영한다.

예상 API:

```http
GET /admin/projects/catalog-sections
POST /admin/projects/catalog-sections
PUT /admin/projects/catalog-sections/:id
DELETE /admin/projects/catalog-sections/:id
PUT /admin/projects/catalog-sections/:id/items
```

구현 상태: 완료

필요성:

- `project_catalog_sections`
- `project_catalog_section_items`

현재는 DB 스키마와 공개 조회는 준비되어 있으므로, 관리자 운영 API만 추가하면 된다.

#### 6.2.2 관련 프로젝트 API

목적: 상세 페이지 하단에 관련 프로젝트를 보여준다.

예상 API:

```http
GET /public/projects/:slug/related?limit=4
```

구현 상태: 완료

추천 기준:

1. 같은 `project_type`
2. 겹치는 `skills`
3. 겹치는 `tags`
4. `catalog_priority`
5. `view_count`

1차에서는 프론트에서 전체 목록 중 필터링해도 되지만, 프로젝트 수가 늘면 백엔드 API가 낫다.

#### 6.2.3 필터 옵션 API

목적: 목록 화면의 필터 옵션을 안정적으로 제공한다.

예상 API:

```http
GET /public/projects/filter-options
```

구현 상태: 완료

반환:

- project types
- statuses
- skills
- tags
- sort options

현재 프론트는 태그 API를 직접 호출해서 필터를 구성한다. 쇼핑몰형 필터가 커지면 전용 옵션 API가 더 명확하다.

### 6.3 관리자 입력 구조

관리자 프로젝트 폼은 쇼핑몰 상품 등록처럼 탭 또는 섹션으로 나눈다.

권장 섹션:

1. 기본 정보
   - title
   - slug
   - project_type
   - status
   - is_published
   - is_featured
   - start_date
   - end_date

2. 카탈로그 카드
   - catalog.title
   - catalog.summary
   - catalog.label
   - catalog.status
   - catalog.badge
   - catalog.image_url
   - catalog.accent_color
   - catalog.cta_label
   - catalog.priority
   - price_label
   - difficulty_label
   - impact_summary
   - primary_metric_label
   - primary_metric_value

3. 링크
   - demo
   - github
   - docs
   - case_study
   - figma

4. 이미지
   - catalog
   - cover
   - gallery
   - detail
   - og

5. 성과 지표
   - metric_group
   - label
   - value
   - unit
   - is_highlighted

6. 기술/태그
   - skills
   - skill importance
   - tags

7. 상세 본문
   - content_json
   - content_html
   - content_text
   - sections

### 6.4 백엔드 작업 목록

1차 작업:

- 현재 공개 API 응답 예시를 문서화한다.
- `/public/projects/catalog` 응답 타입을 프론트와 맞춘다.
- 관리자 프로젝트 create/update payload 예시를 Swagger 또는 문서에 추가한다.

2차 작업:

- 관리자 카탈로그 섹션 관리 API를 추가한다.
- 프로젝트 관련 추천 API를 추가한다.
- 필터 옵션 API를 추가한다.

3차 작업:

- 조회수 기반 추천 API 추가
- 블로그와 프로젝트 연결 테이블 추가
- 관리자 이미지 갤러리 목록/전체 교체 API 추가
- 캐시 무효화와 문서 정합성 보강

## 7. 데이터 계약

### 7.1 프론트엔드 타입 제안

```ts
export interface ProjectCatalogProfile {
  title: string;
  summary: string | null;
  label: string | null;
  status: string | null;
  badge: string | null;
  image_url: string | null;
  image_alt?: string | null;
  accent_color: string | null;
  cta_label: string;
  priority: number;
  price_label: string | null;
  difficulty_label: string | null;
  impact_summary: string | null;
  primary_metric: {
    label: string | null;
    value: string | null;
  } | null;
}

export interface ProjectMetric {
  id: string;
  metric_group: string;
  label: string;
  value: string;
  unit?: string | null;
  description?: string | null;
  display_order: number;
  is_highlighted: boolean;
}

export interface ProjectLink {
  id: string;
  link_type: 'demo' | 'github' | 'docs' | 'case_study' | 'figma' | 'download' | 'other';
  label: string;
  url: string;
  display_order: number;
  is_primary: boolean;
}

export interface ProjectImage {
  id: string;
  image_type: 'catalog' | 'cover' | 'gallery' | 'detail' | 'og';
  image_url: string;
  alt_text?: string | null;
  caption?: string | null;
  width?: number | null;
  height?: number | null;
  display_order: number;
  is_primary: boolean;
}
```

### 7.2 카탈로그 API 응답 형태

```ts
export interface ProjectCatalogSection {
  id: string;
  name: string;
  slug: string;
  description?: string | null;
  section_type: 'featured' | 'new_arrivals' | 'popular' | 'case_study' | 'stack' | 'custom';
  display_order: number;
  items: Project[];
}

export interface ProjectCatalogResponse {
  sections: ProjectCatalogSection[];
  sectionLimit: number;
}
```

### 7.3 프론트 API 클라이언트 추가

```ts
type ProjectCatalogParams = {
  limit?: number;
};

const getCatalog = (params?: ProjectCatalogParams) =>
  api.get<ProjectCatalogResponse>('/public/projects/catalog', params);
```

## 8. 화면별 구현 기준

### 8.1 홈 카탈로그

완료 기준:

- `/public/projects/catalog` 응답으로 섹션을 렌더링한다.
- 섹션이 비어 있으면 해당 섹션을 숨긴다.
- 카드 클릭 시 상세 페이지로 이동한다.
- demo/github 링크는 새 탭으로 열린다.
- 모바일에서 카드가 1열 또는 가로 스크롤로 깨지지 않게 표시된다.

### 8.2 프로젝트 목록

완료 기준:

- 검색어가 URL query에 반영된다.
- 필터가 URL query에 반영된다.
- 새로고침해도 필터 상태가 유지된다.
- 서버 pagination metadata를 사용한다.
- 빈 결과 상태가 있다.
- 로딩 skeleton이 있다.

### 8.3 프로젝트 상세

완료 기준:

- catalog profile이 상단에 반영된다.
- metrics가 핵심 지표 카드로 보인다.
- links가 CTA 버튼으로 보인다.
- images가 gallery로 보인다.
- content_html 또는 content_json이 상세 본문으로 표시된다.
- 조회수 증가 API가 한 번 호출된다.
- 최근 본 프로젝트가 로컬 스토리지에 저장된다.

### 8.4 관리자 프로젝트 폼

완료 기준:

- 기본 정보와 카탈로그 정보가 분리되어 있다.
- 링크를 여러 개 추가/삭제할 수 있다.
- 이미지 타입별 입력이 가능하다.
- 성과 지표를 여러 개 추가/삭제할 수 있다.
- 스킬 importance를 지정할 수 있다.
- 저장 payload가 백엔드의 nested 구조와 맞는다.

## 9. 개발 단계

### 9.1 1차 MVP

목표: 방문자가 쇼핑몰처럼 프로젝트를 탐색하고 상세를 볼 수 있다.

프론트엔드:

- `Project` 타입 확장
- `projectApi.getCatalog` 추가
- `ProjectCatalogCard` 구현
- 홈 또는 `/projects` 상단에 카탈로그 섹션 연결
- 프로젝트 상세 상단 개편

백엔드:

- 현재 API 유지
- 응답 예시 문서화
- 필요한 경우 Swagger 설명 보강

테스트:

- API 타입 매핑 확인
- 프로젝트 카드 렌더링 테스트
- 상세 페이지 필수 CTA 렌더링 테스트

### 9.2 2차 탐색 기능

목표: 검색/필터/정렬이 쇼핑몰처럼 작동한다.

프론트엔드:

- URL query 기반 검색
- 서버 필터 기반 목록 조회
- 필터 panel/drawer
- 정렬 select
- pagination 연동

백엔드:

- 필터 옵션 API 검토
- 검색 대상 보강 여부 확인
- 관련 테스트 보강

### 9.3 3차 운영 기능

목표: 관리자가 쇼핑몰 상품 등록처럼 프로젝트를 관리한다.

프론트엔드:

- 관리자 프로젝트 폼 탭 구조
- catalog/links/images/metrics/skills 입력 UI
- 카탈로그 섹션 배치 UI

백엔드:

- 관리자 카탈로그 섹션 CRUD
- 섹션 아이템 정렬 API
- 프로젝트 관련 추천 API

### 9.4 4차 고도화

목표: 탐색 유지와 추천 품질을 높인다.

프론트엔드:

- 관심 프로젝트
- 비교함
- 최근 본 프로젝트
- 관련 프로젝트 UI

백엔드:

- 관련 프로젝트 API
- 조회 기반 추천
- 블로그-프로젝트 연결

## 10. 작업 순서 제안

가장 현실적인 순서는 다음이다.

1. 프론트 타입과 API 클라이언트를 새 백엔드 구조에 맞춘다.
2. 프로젝트 카드 컴포넌트를 만든다.
3. `/public/projects/catalog`로 카탈로그 섹션을 렌더링한다.
4. 상세 페이지 상단과 지표/링크/이미지 영역을 개편한다.
5. 목록 페이지 검색/필터/정렬을 서버 query 기반으로 바꾼다.
6. 관리자 프로젝트 폼을 nested payload 구조로 바꾼다.
7. 관리자 카탈로그 섹션 관리 API와 UI를 추가한다.
8. 관심 프로젝트/비교함/최근 본 프로젝트를 붙인다.

## 11. 리스크와 대응

| 리스크 | 설명 | 대응 |
| --- | --- | --- |
| 쇼핑몰처럼 보이기만 하고 내용이 약해짐 | 카드/배지만 강조하면 포트폴리오 설득력이 떨어짐 | 상세에 문제/해결/성과/검증을 필수 섹션으로 둔다 |
| 프론트 타입과 백엔드 응답 불일치 | 현재 프론트 타입은 legacy 필드가 많음 | 타입 확장을 첫 작업으로 둔다 |
| 관리자 입력 복잡도 증가 | catalog, metrics, links, images가 한 화면에 많아짐 | 탭/섹션으로 분리하고 preview를 제공한다 |
| 필터가 너무 많아짐 | 쇼핑몰처럼 복잡해질 수 있음 | 1차는 유형/기술/태그/정렬만 제공한다 |
| 비교함이 장난스럽게 보임 | 장바구니 느낌이 과하면 포트폴리오 품질이 낮아 보일 수 있음 | 명칭을 비교함 또는 검토 목록으로 제한한다 |

## 12. 최종 판단

이 구상은 괜찮다. 특히 백엔드가 이미 `project_catalog_profiles`, `project_catalog_sections`, `project_metrics`, `project_links`, `project_images` 중심으로 준비되어 있어서 프론트엔드에서 바로 적용할 수 있는 기반이 있다.

다만 성공 기준은 쇼핑몰 UI를 흉내 내는 것이 아니다. 사용자가 프로젝트를 더 빠르게 찾고, 더 쉽게 비교하고, 상세에서 더 강하게 설득되는 구조를 만드는 것이 핵심이다.

따라서 1차 구현은 `카탈로그 홈`, `프로젝트 카드`, `상세 페이지 개편`에 집중하고, 관심 프로젝트/비교함/추천 고도화는 2차 이후로 미루는 것이 좋다.
