# 로깅 시스템 가이드

서버 로그는 Winston과 `winston-daily-rotate-file`을 사용합니다. 현재 포맷은 JSON 로그가 아니라 사람이 바로 읽기 쉬운 한 줄 로그입니다.

```text
2026-05-25 14:30:25 INFO request.ok req=... method=GET path=/api/public/profile status=200 duration=12ms ip=...
2026-05-25 14:31:10 WARN request.warn req=... method=POST path=/api/admin/login status=401 duration=43ms ip=...
2026-05-25 14:32:03 ERROR 서버 오류 req=... method=POST path=/api/admin/projects status=500 details={...}
```

## 로그 출력 위치

- 콘솔: 서버 프로세스 표준 출력
- 파일: `logs/YYYY-MM-DD.log`
- 로테이션: 기본 최대 `20m`, 보관 `14d`
- 환경 변수: `LOG_MAX_SIZE`, `LOG_MAX_FILES`로 조정

`logs/*.log`와 감사 임시 파일은 `.gitignore` 대상입니다.

## 로그 레벨

- `error`: 서버 오류, DB 실패, Redis 작업 실패 같은 장애성 이벤트
- `warn`: 인증 실패, rate limit, 요청 타임아웃, 4xx 응답, 느린 요청
- `info`: 서버 시작, 운영 요청 요약, 감사 로그
- `debug`: 상세 요청/응답, SQL 실행 등 verbose 로그

운영에서는 기본적으로 `LOG_LEVEL=info`, `ENABLE_VERBOSE_LOGS=false`를 권장합니다.

## 운영 중 출력 기준

`ENABLE_VERBOSE_LOGS=false`일 때도 아래 로그는 남습니다.

- 관리자 API 요청 요약
- `POST`, `PUT`, `PATCH`, `DELETE` 요청 요약
- 로그인/로그아웃 요청 요약
- 4xx/5xx 응답 요약
- `SLOW_REQUEST_MS` 이상 걸린 느린 요청
- 보안 이벤트와 rate limit 이벤트
- 서버 시작/환경 요약
- DB 실패 및 느린 쿼리
- 관리자 감사 로그

아래 로그는 verbose가 켜져 있을 때만 남습니다.

- 상세 요청 body/query 로그
- 상세 응답 로그
- 일반 DB 성공 debug 로그
- 시간별 내부 통계 로그

## 주요 로그 형식

### 요청 요약

```text
2026-05-25 14:30:25 INFO request.ok req=2b51... method=GET path=/api/public/profile status=200 duration=12ms ip=203.0.113.10
2026-05-25 14:31:10 WARN request.warn req=91cc... method=POST path=/api/admin/login status=401 duration=43ms ip=203.0.113.10
2026-05-25 14:32:40 WARN request.slow req=778a... method=GET path=/api/admin/dashboard status=200 duration=1250ms admin=admin#1
2026-05-25 14:33:02 ERROR request.error req=3f2d... method=POST path=/api/admin/projects status=500 duration=80ms admin=admin#1
```

### 보안 이벤트

```text
2026-05-25 14:35:01 WARN security.warn details={"message":"로그인 실패 - 잘못된 비밀번호","username":"admin","ipAddress":"203.0.113.10"}
2026-05-25 14:36:15 WARN Admin rate limit exceeded ip=203.0.113.10 details={"userAgent":"Mozilla/5.0","url":"/api/admin/users","method":"GET"}
```

### 감사 로그

```text
2026-05-25 14:40:10 INFO audit.admin action=update_project user=admin#1 resource=projects resourceId=portfolio-api
```

관리자 활동은 파일 로그와 별도로 DB 감사 로그에도 기록됩니다. DB 감사 로그 기록 실패는 요청 성공/실패 응답을 막지 않고 서버 로그에만 남깁니다.

### DB 로그

```text
2026-05-25 14:41:22 WARN 느린 쿼리 감지 details={"query":"SELECT ...","paramCount":2,"duration":"1250ms"}
2026-05-25 14:42:03 ERROR 데이터베이스 쿼리 실패 details={"query":"UPDATE ...","paramCount":3,"duration":"90ms","errno":1205}
```

DB 로그에는 SQL 파라미터 원문을 남기지 않습니다. 민감한 값이 포함될 수 있으므로 `params` 대신 `paramCount`만 기록합니다.

## 민감정보 마스킹

로그 메타데이터는 `password`, `token`, `secret`, `authorization`, `cookie`, `api_key` 등 민감 키를 `[REDACTED]`로 마스킹합니다.

예시:

```text
details={"body":{"username":"admin","password":"[REDACTED]"}}
```

DB 쿼리 파라미터 배열은 키 기반 마스킹이 어려워 로그에서 제거했습니다.

## 실시간 확인

```bash
tail -f logs/$(date +%Y-%m-%d).log
tail -f logs/$(date +%Y-%m-%d).log | grep "ERROR"
tail -f logs/$(date +%Y-%m-%d).log | grep "request.warn"
tail -f logs/$(date +%Y-%m-%d).log | grep "request.slow"
```

## 자주 쓰는 검색

```bash
# 서버 오류
grep "ERROR" logs/*.log

# 4xx 요청
grep "request.warn" logs/*.log

# 느린 요청
grep "request.slow" logs/*.log

# 관리자 감사 로그
grep "audit.admin" logs/*.log

# 특정 request id 추적
grep "req=2b51" logs/*.log

# 특정 경로 확인
grep "path=/api/admin/login" logs/*.log
```

## 일일 요약 예시

```bash
#!/bin/bash

LOG_FILE="logs/$(date +%Y-%m-%d).log"

echo "=== 서버 로그 요약 ==="
echo "전체 요청: $(grep -c "request." "$LOG_FILE")"
echo "경고 요청: $(grep -c "request.warn" "$LOG_FILE")"
echo "서버 오류: $(grep -c "request.error" "$LOG_FILE")"
echo "느린 요청: $(grep -c "request.slow" "$LOG_FILE")"
echo "감사 로그: $(grep -c "audit.admin" "$LOG_FILE")"
echo "보안 경고: $(grep -c "security.warn" "$LOG_FILE")"
```

## 운영 권장 설정

```env
LOG_LEVEL=info
ENABLE_VERBOSE_LOGS=false
SLOW_REQUEST_MS=1000
LOG_MAX_SIZE=20m
LOG_MAX_FILES=14d
```

장애 분석 중 일시적으로 상세 로그가 필요할 때만 `ENABLE_VERBOSE_LOGS=true` 또는 `LOG_LEVEL=debug`를 사용하세요. 상세 로그는 요청 body/query와 SQL 실행 정보를 더 많이 남기므로 운영 상시 사용은 권장하지 않습니다.

## 트러블슈팅

### 로그 파일이 생성되지 않는 경우

- 서버 프로세스가 `logs/` 디렉터리를 생성할 권한이 있는지 확인합니다.
- 컨테이너/PM2/systemd 실행 사용자가 프로젝트 디렉터리에 쓰기 권한을 갖는지 확인합니다.

### 요청이 너무 많이 기록되는 경우

- 운영에서 `ENABLE_VERBOSE_LOGS=false`인지 확인합니다.
- `LOG_LEVEL=info` 이하로 유지합니다.
- 정상 공개 GET 요청은 기본적으로 모두 기록되지 않으며, 관리자/변경 요청/오류/느린 요청 위주로 남습니다.

### 실제 클라이언트 IP가 프록시 IP로 보이는 경우

- Nginx 같은 단일 리버스 프록시 뒤에서는 `TRUST_PROXY=1`을 설정합니다.
- Nginx에서 `X-Forwarded-For`, `X-Real-IP`, `X-Forwarded-Proto` 헤더가 전달되는지 확인합니다.
