const test = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const { clearRootModules, stubRootModule, createNoopLogger } = require('./helpers/module-loader');
const { requestJson } = require('./helpers/http-route-server');

function createRouter() {
    const previousNormal = process.env.REQUEST_TIMEOUT;
    const previousAi = process.env.AI_REQUEST_TIMEOUT;
    process.env.REQUEST_TIMEOUT = '30';
    process.env.AI_REQUEST_TIMEOUT = '1000';
    clearRootModules([['middleware', 'request-timeout.ts'], ['log.ts']]);
    stubRootModule(['log.ts'], createNoopLogger());
    let requestTimeoutMiddleware;
    try {
        ({ requestTimeoutMiddleware } = require('../middleware/request-timeout.ts'));
    } finally {
        if (previousNormal === undefined) delete process.env.REQUEST_TIMEOUT;
        else process.env.REQUEST_TIMEOUT = previousNormal;
        if (previousAi === undefined) delete process.env.AI_REQUEST_TIMEOUT;
        else process.env.AI_REQUEST_TIMEOUT = previousAi;
    }
    const router = express.Router();
    router.use(requestTimeoutMiddleware);
    const respondLater = async (_req, res) => {
        await new Promise(resolve => setTimeout(resolve, 100));
        if (!res.writableEnded) res.json({ success: true });
    };
    router.get('/admin/ai/probe', respondLater);
    router.get('/admin/airline', respondLater);
    router.get('/ordinary', respondLater);
    return router;
}

for (const url of ['/admin/ai/probe', '/ADMIN/AI/probe', '/AdMiN/Ai/probe?next=/ordinary']) {
    test(`AI 요청은 경로 대소문자와 관계없이 전용 시간 제한을 사용한다: ${url}`, async () => {
        const result = await requestJson(createRouter(), url);
        assert.equal(result.status, 200);
        assert.deepEqual(result.body, { success: true });
    });
}

for (const url of ['/ordinary', '/admin/airline']) {
    test(`AI 경로가 아닌 요청은 일반 시간 제한을 유지한다: ${url}`, async () => {
        const result = await requestJson(createRouter(), url);
        assert.equal(result.status, 408);
        assert.equal(result.body.timeout, 30);
    });
}
