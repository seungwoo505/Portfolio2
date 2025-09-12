# 📊 로깅 시스템 가이드

완전한 로깅 시스템이 구현되어 서버의 모든 활동을 추적할 수 있습니다.

## 🔧 **로그 시스템 구조**

### **Winston 기반 로깅**

- **파일 로깅**: 날짜별 로테이션 (최대 14일, 20MB 파일)
- **콘솔 로깅**: 개발 환경에서 컬러 출력
- **JSON 형식**: 구조화된 로그로 분석 용이

### **로그 레벨**

- `error` - 에러 및 예외 상황
- `warn` - 경고 및 보안 이벤트
- `info` - 일반 정보 및 API 요청
- `debug` - 상세 디버깅 정보 (SQL 쿼리 등)

## 📁 **로그 파일 구조**

```
logs/
├── 2024-01-15.log    # 일별 로그 파일
├── 2024-01-16.log
└── ...
```

## 🎯 **로그 카테고리**

### **1. HTTP 요청 로그**

모든 API 요청이 자동으로 기록됩니다:

```json
{
  "timestamp": "2024-01-15 14:30:25",
  "level": "info",
  "message": "HTTP Request",
  "method": "POST",
  "url": "/api/contact",
  "statusCode": 201,
  "responseTime": "45ms",
  "ip": "192.168.1.100",
  "userAgent": "Mozilla/5.0...",
  "contentLength": 256
}
```

### **2. 인증 로그**

관리자 로그인/로그아웃 추적:

```json
{
  "timestamp": "2024-01-15 14:30:25",
  "level": "info",
  "message": "[AUTH] Login successful",
  "user": {
    "id": 1,
    "username": "admin",
    "role": "super_admin"
  },
  "ipAddress": "192.168.1.100"
}
```

### **3. 보안 로그**

보안 관련 이벤트 추적:

```json
{
  "timestamp": "2024-01-15 14:30:25",
  "level": "warn",
  "message": "[SECURITY] Login failed - Invalid password",
  "username": "admin",
  "failedAttempts": 3,
  "ipAddress": "192.168.1.100"
}
```

### **4. 데이터베이스 로그**

SQL 쿼리 성능 및 오류 추적:

```json
{
  "timestamp": "2024-01-15 14:30:25",
  "level": "info",
  "message": "[DATABASE] Query executed successfully",
  "duration": "25ms",
  "rowCount": 1,
  "queryType": "SELECT"
}
```

### **5. 관리자 활동 로그**

관리자의 모든 활동 기록:

```json
{
  "timestamp": "2024-01-15 14:30:25",
  "level": "info",
  "message": "[ADMIN] Blog post created",
  "admin": {
    "id": 1,
    "username": "admin",
    "role": "super_admin"
  },
  "action": "create_blog_post",
  "resourceId": 123
}
```

### **6. 에러 로그**

예외 및 오류 상황:

```json
{
  "timestamp": "2024-01-15 14:30:25",
  "level": "error",
  "message": "Database query failed",
  "error": "Connection timeout",
  "query": "SELECT * FROM blog_posts",
  "duration": "5000ms",
  "errno": 1205
}
```

## ⚙️ **환경 변수 설정**

```env
# .env 파일
LOG_LEVEL=info          # 로그 레벨 (error, warn, info, debug)
NODE_ENV=production     # 환경 (development, production)
```

### **로그 레벨별 출력**

- `error`: 에러만
- `warn`: 경고 + 에러
- `info`: 정보 + 경고 + 에러 (기본값)
- `debug`: 모든 로그 (SQL 쿼리 포함)

## 🔍 **로그 분석 방법**

### **1. 실시간 로그 모니터링**

```bash
# 실시간 로그 확인
tail -f logs/$(date +%Y-%m-%d).log

# 에러만 필터링
tail -f logs/$(date +%Y-%m-%d).log | grep "ERROR"

# 특정 IP 추적
tail -f logs/$(date +%Y-%m-%d).log | grep "192.168.1.100"
```

### **2. 로그 검색**

```bash
# 특정 날짜의 로그인 시도
grep "Login attempt" logs/2024-01-15.log

# 실패한 로그인 찾기
grep "Login failed" logs/*.log

# 데이터베이스 에러 검색
grep "Database query failed" logs/*.log

# 특정 사용자 활동
grep "username.*admin" logs/*.log
```

### **3. JSON 로그 분석 (jq 사용)**

```bash
# 에러 로그만 추출
cat logs/2024-01-15.log | jq 'select(.level == "error")'

# 응답 시간이 긴 요청 찾기
cat logs/2024-01-15.log | jq 'select(.responseTime and (.responseTime | tonumber > 1000))'

# IP별 요청 수 집계
cat logs/2024-01-15.log | jq -r '.ip' | sort | uniq -c | sort -nr
```

## 📈 **로그 분석 스크립트**

### **일일 통계 스크립트**

```bash
#!/bin/bash
# daily-stats.sh

LOG_FILE="logs/$(date +%Y-%m-%d).log"

echo "=== 일일 로그 통계 ==="
echo "날짜: $(date +%Y-%m-%d)"
echo ""

echo "📊 요청 통계:"
echo "총 요청 수: $(grep -c "HTTP Request" $LOG_FILE)"
echo "성공 요청: $(grep "HTTP Request" $LOG_FILE | grep -c '"statusCode":2')"
echo "에러 요청: $(grep "HTTP Request" $LOG_FILE | grep -c '"statusCode":[45]')"
echo ""

echo "🔐 인증 통계:"
echo "로그인 시도: $(grep -c "Login attempt" $LOG_FILE)"
echo "로그인 성공: $(grep -c "Login successful" $LOG_FILE)"
echo "로그인 실패: $(grep -c "Login failed" $LOG_FILE)"
echo ""

echo "⚠️  보안 이벤트:"
echo "계정 잠금: $(grep -c "Account locked" $LOG_FILE)"
echo "잘못된 비밀번호: $(grep -c "Invalid password" $LOG_FILE)"
echo ""

echo "📧 연락처 폼:"
echo "메시지 수신: $(grep -c "Contact form submission" $LOG_FILE)"
echo "전송 성공: $(grep -c "Contact message created successfully" $LOG_FILE)"
```

### **에러 분석 스크립트**

```bash
#!/bin/bash
# error-analysis.sh

echo "=== 최근 에러 분석 ==="
echo ""

echo "🚨 최근 에러 (최신 10개):"
grep '"level":"error"' logs/*.log | tail -10 | jq -r '.timestamp + " - " + .message'
echo ""

echo "📊 에러 유형별 통계:"
grep '"level":"error"' logs/*.log | jq -r '.message' | sort | uniq -c | sort -nr
echo ""

echo "🌐 에러가 많은 IP:"
grep '"level":"error"' logs/*.log | jq -r '.ip' | grep -v null | sort | uniq -c | sort -nr | head -5
```

## 🔧 **로그 관리**

### **로그 로테이션**

자동으로 날짜별 로테이션이 설정되어 있습니다:

- 파일명: `YYYY-MM-DD.log`
- 최대 크기: 20MB
- 보관 기간: 14일
- 압축: 비활성화 (분석 용이성을 위해)

### **로그 정리**

```bash
# 30일 이상 된 로그 삭제
find logs/ -name "*.log" -mtime +30 -delete

# 로그 압축 (수동)
gzip logs/$(date -d "yesterday" +%Y-%m-%d).log
```

## 🛠 **사용자 정의 로그**

코드에서 직접 로그를 남기는 방법:

```javascript
const logger = require("./log");

// 기본 로그
logger.info("Something happened");
logger.warn("Warning message");
logger.error("Error occurred");

// 구조화된 로그
logger.info("User action", {
  userId: 123,
  action: "profile_update",
  changes: ["name", "email"],
});

// 헬퍼 함수 사용
logger.auth("Password changed", user, { method: "admin_reset" });
logger.security("Suspicious activity detected", { ip, attempts: 5 });
logger.database("Slow query detected", { query, duration: "2.5s" });
```

## 📊 **실시간 모니터링**

### **PM2 로그 모니터링**

```bash
# PM2로 실행 중인 경우
pm2 logs portfolio-server

# 에러만 모니터링
pm2 logs portfolio-server --err
```

### **로그 알림 설정**

중요한 이벤트에 대한 알림을 설정할 수 있습니다:

```bash
# Fail2ban과 연동하여 자동 차단
# /etc/fail2ban/filter.d/portfolio-server.conf
[Definition]
failregex = .*"level":"warn".*"message":"\[SECURITY\] Login failed".*"ipAddress":"<HOST>"
ignoreregex =
```

## 🔍 **트러블슈팅**

### **자주 발생하는 문제들**

#### **1. 로그 파일 권한 문제**

```bash
# 로그 디렉토리 권한 설정
chmod 755 logs/
chmod 644 logs/*.log
```

#### **2. 디스크 공간 부족**

```bash
# 로그 파일 크기 확인
du -sh logs/

# 큰 로그 파일 찾기
find logs/ -size +100M -ls
```

#### **3. 로그 레벨 변경이 적용되지 않음**

```bash
# 서버 재시작 필요
pm2 restart portfolio-server
```

## 📈 **성능 고려사항**

### **로그 성능 최적화**

- 비동기 로깅으로 응답 속도에 영향 없음
- JSON 구조화로 분석 도구 활용 가능
- 로그 레벨 조정으로 필요한 정보만 기록

### **저장 공간 관리**

- 자동 로테이션으로 디스크 공간 절약
- 압축 옵션 활용 가능
- 오래된 로그 자동 삭제

이 로깅 시스템으로 서버의 모든 활동을 추적하고 문제를 빠르게 진단할 수 있습니다! 🚀
