const test = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const { configureSecurityMiddleware } = require('../config/security.ts');
const { validateProductionEnv } = require('../utils/env-validation.ts');
const { startRouterServer } = require('./helpers/http-route-server');

const configureApp = (t, values) => {
    for (const key of ['MY_HOST', 'LOCALHOST']) {
        const previous = process.env[key];
        if (values[key] === undefined) delete process.env[key];
        else process.env[key] = values[key];
        t.after(() => {
            if (previous === undefined) delete process.env[key];
            else process.env[key] = previous;
        });
    }
    const app = express();
    configureSecurityMiddleware(app);
    app.get('/probe', (_req, res) => res.json({ success: true }));
    return app;
};

// URL 검증에서 허용한 주소를 원문 비교하면 브라우저가 보내는 정규 Origin과 달라 실패한다.
for (const configured of ['https://portfolio.test/', ' HTTPS://PORTFOLIO.TEST:443/app?view=home#top ']) {
    test(`운영 URL ${configured}의 정규 Origin을 CORS에서 허용한다`, async t => {
        const validation = validateProductionEnv({
            NODE_ENV: 'production', DB_HOST: 'db.internal', DB_PORT: '3306', DB_USER: 'portfolio',
            DB_PASSWORD: 'strong-database-password', DB_SCHEMA: 'portfolio',
            JWT_SECRET: 'a'.repeat(32), JWT_REFRESH_SECRET: 'b'.repeat(32), MY_HOST: configured
        });
        assert.deepEqual(validation, { ok: true, errors: [] });
        const server = await startRouterServer(configureApp(t, { MY_HOST: configured }));
        t.after(server.close);
        for (const origin of ['https://portfolio.test', 'https://portfolio.test.attacker.invalid', 'https://other.test']) {
            const response = await fetch(server.baseUrl + '/probe', { headers: { Origin: origin } });
            assert.equal(response.status, 200);
            assert.equal(response.headers.get('access-control-allow-origin'), origin === 'https://portfolio.test' ? origin : null);
            await response.json();
        }
    });
}

test('LOCALHOST URL도 기본 포트와 경로를 제거한 Origin으로 preflight를 허용한다', async t => {
    const server = await startRouterServer(configureApp(t, { LOCALHOST: 'HTTP://LOCALHOST:80/dev/' }));
    t.after(server.close);
    const response = await fetch(server.baseUrl + '/probe', {
        method: 'OPTIONS', headers: { Origin: 'http://localhost', 'Access-Control-Request-Method': 'GET' }
    });
    assert.equal(response.status, 204);
    assert.equal(response.headers.get('access-control-allow-origin'), 'http://localhost');
    assert.equal(response.headers.get('access-control-allow-credentials'), 'true');
});

for (const configured of ['not-a-url', 'file:///portfolio', 'ftp://portfolio.test']) {
    test(`잘못된 CORS 설정 ${configured}로 외부 Origin이나 null을 허용하지 않는다`, async t => {
        const server = await startRouterServer(configureApp(t, { MY_HOST: configured }));
        t.after(server.close);
        for (const origin of ['null', 'https://portfolio.test']) {
            const response = await fetch(server.baseUrl + '/probe', { headers: { Origin: origin } });
            assert.equal(response.status, 200);
            assert.equal(response.headers.get('access-control-allow-origin'), null);
            await response.json();
        }
    });
}
