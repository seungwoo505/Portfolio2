import type { Pool, PoolConnection, PoolOptions } from "mysql2/promise";

const mariaDB = require("mysql2/promise");
const logger = require('./log');

const db: Pool = mariaDB.createPool({
    host : process.env.DB_HOST,
    port : process.env.DB_PORT,
    user : process.env.DB_USER,
    password : process.env.DB_PASSWORD,
    database : process.env.DB_SCHEMA,

    charset: 'utf8mb4',
    connectionLimit: 30,
    queueLimit: 0,
    idleTimeout: 600000,
    multipleStatements: false,
    dateStrings: true,
    supportBigNumbers: true,
    bigNumberStrings: true,

    compress: true,
    flags: ['-FOUND_ROWS'],

    ssl: false,
    enableKeepAlive: true,
    keepAliveInitialDelay: 0,

    typeCast: true,
    rowsAsArray: false,
    namedPlaceholders: false,
    timezone: 'Z',
} as unknown as PoolOptions);

db.on('connection', (connection: PoolConnection) => {
    logger.debug('새로운 데이터베이스 연결 생성', { threadId: connection.threadId });
});

db.on('acquire', (_connection: PoolConnection) => {
});

db.on('release', (_connection: PoolConnection) => {
});

const dbWithErrorEvent = db as Pool & {
    on(event: 'error', listener: (err: Error) => void): Pool;
};

dbWithErrorEvent.on('error', (err: Error) => {
    logger.error('데이터베이스 연결 오류', { error: err.message, stack: err.stack });
});

module.exports = db;
