const test = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const { clearRootModules, stubRootModule } = require('./helpers/module-loader');
const { startRouterServer } = require('./helpers/http-route-server');

const devices = [
    {
        name: 'iPhone', expected: 'iOS | Safari',
        ua: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1'
    },
    {
        name: 'iPad', expected: 'iOS | Safari',
        ua: 'Mozilla/5.0 (iPad; CPU OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1'
    },
    {
        name: 'Mac', expected: 'macOS | Safari',
        ua: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 Version/17.0 Safari/605.1.15'
    },
    {
        name: 'Android', expected: 'Android | Chrome',
        ua: 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36'
    }
];

for (const { name, ua, expected } of devices) {
    test(`${name} 요청의 실제 감사 로그에 올바른 운영체제와 브라우저를 전달한다`, { timeout: 5000 }, async () => {
        clearRootModules([
            ['middleware', 'auth', 'common.ts'], ['middleware', 'auth', 'activity.ts'],
            ['middleware', 'auth', 'activity', 'request.ts'], ['middleware', 'auth', 'activity', 'details.ts']
        ]);
        let record;
        const logged = new Promise(resolve => { record = resolve; });
        stubRootModule(['middleware', 'auth', 'common.ts'], {
            logger: { redact: body => body || {}, error: error => { throw error; } },
            AdminActivityLogs: { log: async (...args) => { record(args); } }
        });
        const { logActivity } = require('../middleware/auth/activity.ts');
        const router = express.Router();
        router.use((req, _res, next) => { req.admin = { id: 1 }; next(); });
        router.put('/admin/users/:id', logActivity('update_admin'), (_req, res) => res.json({ success: true }));
        const server = await startRouterServer(router, { json: true });
        try {
            const response = await fetch(`${server.baseUrl}/admin/users/2`, {
                method: 'PUT', headers: { 'Content-Type': 'application/json', 'User-Agent': ua },
                body: JSON.stringify({ full_name: '변경된 이름' })
            });
            assert.equal(response.status, 200);
            await response.json();
            const args = await logged;
            assert.equal(args[0], 1);
            assert.equal(args[1], 'update_admin');
            assert.equal(args[6], expected);
        } finally {
            await server.close();
        }
    });
}
