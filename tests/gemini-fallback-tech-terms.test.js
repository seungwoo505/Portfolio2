const test = require('node:test');
const assert = require('node:assert/strict');
const { stubRootModule, createNoopLogger } = require('./helpers/module-loader');
const { requestJson } = require('./helpers/http-route-server');

const logger = createNoopLogger();
stubRootModule(['services', 'gemini-ai', 'common.ts'], { logger, verboseDebug: () => {} });
stubRootModule(['routes', 'admin', 'common.ts'], { logger, verboseDebug: () => {}, buildErrorLog: error => ({ error: error.message }) });
stubRootModule(['db.ts'], { execute: async () => [[]] });
stubRootModule(['middleware', 'auth.ts'], {
    authenticateToken: (_req, _res, next) => next(),
    requirePermission: () => (_req, _res, next) => next()
});
const service = {
    ...require('../services/gemini-ai/markdown.ts'), ...require('../services/gemini-ai/summary.ts'),
    ...require('../services/gemini-ai/fallback-summary.ts'), ...require('../services/gemini-ai/keywords.ts')
};
stubRootModule(['services', 'gemini-ai.ts'], service);
const router = require('../routes/admin/ai.ts');

for (const failedAi of [false, true]) {
    for (const term of ['Next.js', 'Node.js', '.NET']) {
        test(`AI ${failedAi ? '실패' : '미설정'} 요약은 ${term} 기술명을 문장 부호로 분리하지 않는다`, async () => {
            service.model = failedAi ? { generateContent: async () => { throw new Error('provider unavailable'); } } : undefined;
            const result = await requestJson(router, '/ai/summarize', {
                method: 'POST', body: {
                    content: `${term}를 사용하여 서버 기능과 정적 페이지 생성 기능을 구현하고 배포 과정을 자동화했습니다.`,
                    techTags: [term]
                }
            });
            assert.equal(result.status, 200);
            assert.ok(result.body.data.summary.startsWith(term), result.body.data.summary);
            assert.ok(result.body.data.summary.length <= 160);
        });
    }
}

for (const failedAi of [false, true]) {
    for (const term of ['Next.js', 'Node.js', '.NET']) {
        test(`AI ${failedAi ? '실패' : '미설정'} 시 200자 넘는 단일 문장의 ${term}도 대체 요약에서 보존한다`, async () => {
            service.model = failedAi ? { generateContent: async () => { throw new Error('provider unavailable'); } } : undefined;
            const content = `${term}를 사용하여 ${'서버개발'.repeat(85)} 기능을 구현했습니다.`;
            assert.ok(content.length > 200);
            const result = await requestJson(router, '/ai/summarize', {
                method: 'POST', body: { content, techTags: [term] }
            });
            assert.equal(result.status, 200);
            assert.ok(result.body.data.summary.startsWith(term), result.body.data.summary);
            assert.ok(result.body.data.summary.length <= 160);
        });
    }
}

test('키워드 대체 요약도 요청 길이를 지키고 다른 단어 내부 기술명을 선택하지 않는다', () => {
    assert.equal(service.createKeywordBasedSummary('Next.js 서버 개발', 12), 'Next.js를 사용한');
    assert.equal(service.createKeywordBasedSummary('React 기반 개발'), 'React를 사용한 개발 내용입니다.');
    assert.equal(service.createKeywordBasedSummary('ReactNative 기반 개발'), '개발 관련 내용입니다.');
    assert.equal(service.createKeywordBasedSummary('Next.js-extra 기반 개발'), '개발 관련 내용입니다.');
});

test('대체 요약의 문장 구분은 일반 종결 부호를 유지하고 버전 소수점을 보존한다', () => {
    assert.deepEqual(service.extractCleanSentences(
        'Node.js 20.5 버전으로 서버를 개발했습니다.다음 문장에서는 배포를 설명합니다! 마지막 문장에서는 테스트를 설명합니다?'
    ), ['Node.js 20.5 버전으로 서버를 개발했습니다', '다음 문장에서는 배포를 설명합니다', '마지막 문장에서는 테스트를 설명합니다']);
});
