const { run } = require('./runner');

const checkServerBoots = () => {
    const bootScript = `
        process.env.PORT = '0';
        process.env.NODE_ENV = 'development';
        process.env.LOCALHOST = 'http://localhost:3000';
        process.env.MY_HOST = 'http://localhost:3333';
        process.env.REDIS_SOCKET = process.env.REDIS_SOCKET || '/tmp/portfolio-server-check.sock';
        require('./server');
        setTimeout(() => process.exit(0), 500);
    `;

    run(['-e', bootScript], 'server boot smoke', {
        stdio: 'pipe',
        timeout: 5000
    });
};

module.exports = {
    checkServerBoots
};
export {};
