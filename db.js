const mariaDB = require("mysql2/promise");
const logger = require('./log');

const db = mariaDB.createPool({
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
});

db.on('connection', (connection) => {
    logger.info('새로운 데이터베이스 연결 생성', { threadId: connection.threadId });
});

db.on('acquire', (connection) => {
});

db.on('release', (connection) => {
});

db.on('error', (err) => {
    logger.error('데이터베이스 연결 오류', { error: err.message, stack: err.stack });
});

module.exports = db;