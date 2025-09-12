# 🚀 배포 가이드

포트폴리오 서버를 실제 운영 환경에 배포하기 위한 완전한 가이드입니다.

## 📋 **배포 전 체크리스트**

### ✅ **1. 의존성 확인**

```bash
# 주요 의존성 설치 확인
npm list express mysql2 bcryptjs jsonwebtoken uuid
```

### ✅ **2. 환경 변수 설정**

```env
# .env 파일 생성
NODE_ENV=production
PORT=3001

# 데이터베이스 설정
DB_HOST=your-db-host
DB_PORT=3306
DB_USER=your-db-user
DB_PASSWORD=your-secure-password
DB_SCHEMA=portfolio_db

# JWT 시크릿 (강력한 랜덤 문자열)
JWT_SECRET=your-super-secure-jwt-secret-key-min-32-chars

# HTTPS 인증서 경로
HTTPS_KEY=/path/to/ssl/private.key
HTTPS_CERT=/path/to/ssl/certificate.crt
HTTPS_CA=/path/to/ssl/ca-bundle.crt

# CORS 허용 도메인
LOCALHOST=http://localhost:3000
MY_HOST=https://yourdomain.com
```

### ✅ **3. 보안 설정**

#### **기본 관리자 패스워드 변경**

```bash
# 서버 시작 후 관리자 로그인하여 패스워드 즉시 변경
# 기본 계정: admin / admin123
```

#### **데이터베이스 사용자 생성**

```sql
-- 전용 DB 사용자 생성 (최소 권한 원칙)
CREATE USER 'portfolio_user'@'%' IDENTIFIED BY 'secure_password';
GRANT SELECT, INSERT, UPDATE, DELETE ON portfolio_db.* TO 'portfolio_user'@'%';
FLUSH PRIVILEGES;
```

## 🛠 **배포 방법**

### **방법 1: PM2를 사용한 배포 (권장)**

```bash
# 1. PM2 전역 설치
npm install -g pm2

# 2. PM2 ecosystem 파일 생성
# ecosystem.config.js 참조

# 3. 애플리케이션 시작
pm2 start ecosystem.config.js

# 4. PM2 프로세스 저장 (재부팅 시 자동 시작)
pm2 save
pm2 startup
```

### **방법 2: Docker를 사용한 배포**

```bash
# 1. Docker 이미지 빌드
docker build -t portfolio-server .

# 2. Docker 컨테이너 실행
docker run -d \
  --name portfolio-server \
  -p 3001:3001 \
  -v /path/to/env:/app/.env \
  -v /path/to/ssl:/app/ssl \
  portfolio-server
```

### **방법 3: systemd 서비스 (Linux)**

```bash
# 1. 서비스 파일 생성
sudo cp portfolio-server.service /etc/systemd/system/

# 2. 서비스 활성화
sudo systemctl enable portfolio-server
sudo systemctl start portfolio-server

# 3. 상태 확인
sudo systemctl status portfolio-server
```

## 📁 **필요한 설정 파일들**

### **ecosystem.config.js (PM2)**

```javascript
module.exports = {
  apps: [
    {
      name: "portfolio-server",
      script: "server.js",
      instances: "max",
      exec_mode: "cluster",
      env: {
        NODE_ENV: "development",
      },
      env_production: {
        NODE_ENV: "production",
        PORT: 3001,
      },
      error_file: "./logs/err.log",
      out_file: "./logs/out.log",
      log_file: "./logs/combined.log",
      time: true,
      max_memory_restart: "1G",
      node_args: "--max-old-space-size=1024",
    },
  ],
};
```

### **Dockerfile**

```dockerfile
FROM node:18-alpine

# 작업 디렉토리 설정
WORKDIR /app

# package.json 복사 및 의존성 설치
COPY package*.json ./
RUN npm ci --only=production

# 소스 코드 복사
COPY . .

# uploads 디렉토리 생성
RUN mkdir -p uploads

# 포트 노출
EXPOSE 3001

# 헬스체크
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node healthcheck.js

# 애플리케이션 시작
CMD ["node", "server.js"]
```

### **portfolio-server.service (systemd)**

```ini
[Unit]
Description=Portfolio Server
After=network.target

[Service]
Type=simple
User=www-data
WorkingDirectory=/var/www/portfolio-server
ExecStart=/usr/bin/node server.js
Restart=on-failure
RestartSec=10
Environment=NODE_ENV=production
EnvironmentFile=/var/www/portfolio-server/.env

[Install]
WantedBy=multi-user.target
```

## 🔧 **Nginx 리버스 프록시 설정**

```nginx
server {
    listen 80;
    server_name yourdomain.com;
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name yourdomain.com;

    ssl_certificate /path/to/ssl/certificate.crt;
    ssl_certificate_key /path/to/ssl/private.key;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;

    # 업로드 파일 크기 제한
    client_max_body_size 10M;

    # API 프록시
    location /api {
        proxy_pass https://localhost:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }

    # 정적 파일 직접 서빙
    location /uploads {
        alias /var/www/portfolio-server/uploads;
        expires 1y;
        add_header Cache-Control "public, immutable";
    }

    # 보안 헤더
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header Referrer-Policy "no-referrer-when-downgrade" always;
    add_header Content-Security-Policy "default-src 'self'" always;
}
```

## 📊 **모니터링 설정**

### **헬스체크 스크립트**

```javascript
// healthcheck.js
const http = require("http");

const options = {
  hostname: "localhost",
  port: process.env.PORT || 3001,
  path: "/api/health",
  method: "GET",
  timeout: 5000,
};

const req = http.request(options, (res) => {
  if (res.statusCode === 200) {
    process.exit(0);
  } else {
    process.exit(1);
  }
});

req.on("error", () => {
  process.exit(1);
});

req.on("timeout", () => {
  req.destroy();
  process.exit(1);
});

req.end();
```

### **로그 관리**

```bash
# 로그 디렉토리 생성
mkdir -p logs

# 로그 로테이션 설정 (logrotate)
# /etc/logrotate.d/portfolio-server
/var/www/portfolio-server/logs/*.log {
    daily
    missingok
    rotate 30
    compress
    delaycompress
    notifempty
    create 644 www-data www-data
    postrotate
        pm2 reloadLogs
    endscript
}
```

## 🔒 **보안 강화**

### **1. 방화벽 설정**

```bash
# UFW 사용 (Ubuntu)
sudo ufw allow ssh
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw deny 3001/tcp  # 직접 접근 차단
sudo ufw enable
```

### **2. 침입 탐지 (Fail2ban)**

```ini
# /etc/fail2ban/jail.local
[portfolio-server]
enabled = true
filter = portfolio-server
logpath = /var/www/portfolio-server/logs/combined.log
maxretry = 5
bantime = 3600
findtime = 600
```

### **3. SSL/TLS 강화**

```bash
# Let's Encrypt 인증서 자동 갱신
0 12 * * * /usr/bin/certbot renew --quiet
```

## 📈 **성능 최적화**

### **1. Redis 캐싱 (선택사항)**

```bash
# Redis 설치 및 설정
sudo apt install redis-server
```

### **2. 데이터베이스 최적화**

```sql
-- 인덱스 확인 및 최적화
ANALYZE TABLE blog_posts;
OPTIMIZE TABLE blog_posts;

-- 슬로우 쿼리 로그 활성화
SET GLOBAL slow_query_log = 'ON';
SET GLOBAL long_query_time = 2;
```

### **3. 압축 설정**

```javascript
// server.js에 추가
const compression = require("compression");
app.use(compression());
```

## 🔧 **문제 해결**

### **일반적인 문제들**

#### **1. 모듈을 찾을 수 없음**

```bash
# node_modules 재설치
rm -rf node_modules package-lock.json
npm install
```

#### **2. 데이터베이스 연결 실패**

```bash
# 연결 테스트
mysql -h DB_HOST -u DB_USER -p DB_SCHEMA
```

#### **3. SSL 인증서 문제**

```bash
# 인증서 권한 확인
sudo chown www-data:www-data /path/to/ssl/*
sudo chmod 600 /path/to/ssl/private.key
sudo chmod 644 /path/to/ssl/certificate.crt
```

#### **4. 메모리 부족**

```bash
# Node.js 메모리 제한 늘리기
node --max-old-space-size=2048 server.js
```

## 📝 **배포 후 확인사항**

### **1. 기능 테스트**

```bash
# API 엔드포인트 테스트
curl -k https://yourdomain.com/api/health
curl -k https://yourdomain.com/api/blog/posts
```

### **2. 보안 테스트**

```bash
# SSL 등급 확인
https://www.ssllabs.com/ssltest/

# 보안 헤더 확인
curl -I https://yourdomain.com
```

### **3. 성능 테스트**

```bash
# 부하 테스트 (선택사항)
npm install -g artillery
artillery quick --count 10 --num 50 https://yourdomain.com/api/health
```

이 가이드를 따라하면 안전하고 안정적인 프로덕션 환경에서 포트폴리오 서버를 운영할 수 있습니다! 🚀
