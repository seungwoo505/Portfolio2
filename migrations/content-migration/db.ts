const mysql = require('mysql2/promise');

const createPool = (database) => mysql.createPool({
    host: process.env.DB_HOST || 'localhost',
    port: Number(process.env.DB_PORT || 3300),
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database,
    charset: 'utf8mb4',
    waitForConnections: true,
    connectionLimit: 5,
    timezone: 'Z'
});

module.exports = {
    createPool
};
export {};
