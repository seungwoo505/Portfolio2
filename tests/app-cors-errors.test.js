const test = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const { stubRootModule, createNoopLogger } = require('./helpers/module-loader');
const { startRouterServer } = require('./helpers/http-route-server');

process.env.LOCALHOST = 'http://localhost:42345';
stubRootModule(['log.ts'], createNoopLogger());
const publicRouter = express.Router();
publicRouter.post('/probe', (_req, res) => res.json({ success: true }));
for (const [route, router] of [['public', publicRouter], ['admin', express.Router()], ['monitoring', express.Router()]]) {
    stubRootModule(['routes', route + '.ts'], router);
}
stubRootModule(['config', 'swagger.ts'], { mountSwaggerDocs: () => {} });
stubRootModule(['middleware', 'request-logging.ts'], { requestLoggingMiddleware: (_req, _res, next) => next() });
const pass = (_req, _res, next) => next();
stubRootModule(['middleware', 'rate-limiters.ts'], {
    generalLimiter: (req, res, next) => req.headers['x-probe-limit'] ? res.status(429).json({ success: false }) : next(),
    publicReadLimiter: pass, adminLimiter: pass, aiLimiter: pass, monitoringLimiter: pass, loginLimiter: pass, contactLimiter: pass
});
const { app } = require('../app.ts');

for (const [label, body, expected] of [['정상 JSON', '{}', 200], ['잘못된 JSON', '{', 400], ['크기 초과 JSON', JSON.stringify('x'.repeat(3 * 1024 * 1024)), 413]]) {
    test(`${label} 응답에도 허용 Origin의 CORS 헤더가 있다`, async () => {
        const server = await startRouterServer(app);
        try {
            const response = await fetch(server.baseUrl + '/public/probe', {
                method: 'POST', headers: { Origin: process.env.LOCALHOST, 'Content-Type': 'application/json' }, body
            });
            assert.equal(response.status, expected);
            assert.equal(response.headers.get('access-control-allow-origin'), process.env.LOCALHOST);
            assert.equal(response.headers.get('access-control-allow-credentials'), 'true');
            await response.json();
        } finally { await server.close(); }
    });
}

test('요청 제한 응답에도 CORS를 적용하고 허용하지 않은 Origin에는 노출하지 않는다', async () => {
    const server = await startRouterServer(app);
    try {
        for (const origin of [process.env.LOCALHOST, 'http://untrusted.invalid']) {
            const response = await fetch(server.baseUrl + '/health', { headers: { Origin: origin, 'X-Probe-Limit': '1' } });
            assert.equal(response.status, 429);
            assert.equal(response.headers.get('access-control-allow-origin'), origin === process.env.LOCALHOST ? origin : null);
            await response.json();
        }
        const preflight = await fetch(server.baseUrl + '/public/probe', {
            method: 'OPTIONS', headers: { Origin: process.env.LOCALHOST, 'Access-Control-Request-Method': 'POST' }
        });
        assert.equal(preflight.status, 204);
        assert.equal(preflight.headers.get('access-control-allow-origin'), process.env.LOCALHOST);
    } finally { await server.close(); }
});
