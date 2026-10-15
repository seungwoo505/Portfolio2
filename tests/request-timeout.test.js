const test = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const { clearRootModules, createNoopLogger, stubRootModule } = require('./helpers/module-loader');
const { requestJson } = require('./helpers/http-route-server');

const createTimeoutRouter = () => {
    const previousTimeout = process.env.REQUEST_TIMEOUT;
    process.env.REQUEST_TIMEOUT = '50';
    clearRootModules([['middleware', 'request-timeout.ts'], ['log.ts']]);
    stubRootModule(['log.ts'], createNoopLogger());
    let requestTimeoutMiddleware;
    try {
        ({ requestTimeoutMiddleware } = require('../middleware/request-timeout.ts'));
    } finally {
        if (previousTimeout === undefined) delete process.env.REQUEST_TIMEOUT;
        else process.env.REQUEST_TIMEOUT = previousTimeout;
    }
    const router = express.Router();
    router.use(requestTimeoutMiddleware);
    router.all('/slow', async (_req, res) => {
        await new Promise(resolve => setTimeout(resolve, 200));
        if (!res.writableEnded) res.json({ success: true });
    });
    router.post('/fast', (_req, res) => res.json({ success: true }));
    return router;
};

for (const method of ['GET', 'POST']) {
    test(`느린 ${method} 요청은 본문 수신 완료와 관계없이 타임아웃된다`, async () => {
        const result = await requestJson(createTimeoutRouter(), '/slow', {
            method,
            ...(method === 'POST' ? { body: { content: '본문' } } : {})
        });
        assert.equal(result.status, 408);
        assert.equal(result.body.success, false);
    });
}

test('제한 시간 안에 끝난 JSON POST 요청은 정상 응답한다', async () => {
    const result = await requestJson(createTimeoutRouter(), '/fast', { method: 'POST', body: {} });
    assert.equal(result.status, 200);
    assert.equal(result.body.success, true);
});
