import type { Server } from "http";

require("dotenv").config({ quiet: true });

const http = require("http");
const logger = require("./log");
const { validateProductionEnv } = require("./utils/env-validation");
const { app, port, REQUEST_TIMEOUT, AI_REQUEST_TIMEOUT } = require("./app");

const productionEnvValidation = validateProductionEnv(process.env);

if (!productionEnvValidation.ok) {
    logger.error("운영 환경 변수 검증 실패", {
        errors: productionEnvValidation.errors
    });
    process.exit(1);
}

const server: Server = http.createServer(app);

logger.info("포트폴리오 서버 시작 중...");
logger.info("환경 설정", {
    nodeEnv: process.env.NODE_ENV || "development",
    port,
    dbHost: process.env.DB_HOST || "localhost",
    dbSchema: process.env.DB_SCHEMA || "portfolio_db",
    corsOrigins: [process.env.LOCALHOST, process.env.MY_HOST].filter(Boolean),
    protocol: "http",
    tlsTermination: "reverse-proxy",
    requestTimeout: `${REQUEST_TIMEOUT}ms`,
    aiRequestTimeout: `${AI_REQUEST_TIMEOUT}ms`
});

server.listen(port, () => {
    logger.info(`포트폴리오 서버가 포트 ${port}에서 실행 중입니다`);
    logger.info(`데이터베이스: ${process.env.DB_HOST}의 ${process.env.DB_SCHEMA}`);
    logger.info(`CORS 허용 도메인: ${[process.env.LOCALHOST, process.env.MY_HOST].join(", ")}`);
    logger.info("서버 시작이 성공적으로 완료되었습니다");
});
