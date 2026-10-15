const test = require('node:test');
const assert = require('node:assert/strict');
const { stubRootModule, createNoopLogger } = require('./helpers/module-loader');
stubRootModule(['services', 'gemini-ai', 'common.ts'], { logger: createNoopLogger(), verboseDebug: () => {} });
stubRootModule(['db.ts'], { execute: async () => [[]] });
const makeService = () => ({
    ...require('../services/gemini-ai/markdown.ts'),
    ...require('../services/gemini-ai/summary.ts'),
    ...require('../services/gemini-ai/fallback-summary.ts'),
    ...require('../services/gemini-ai/keywords.ts')
});

for (const failedAi of [false, true]) {
    test(`AI ${failedAi ? '실패' : '미설정'} 시 긴 문장도 의미 있는 길이 제한 요약을 반환한다`, async () => {
        const service = makeService();
        if (failedAi) service.model = { generateContent: async () => { throw new Error('AI 실패'); } };
        const summary = await service.generateSummary('개발'.repeat(85) + '. ' + '설계'.repeat(85) + '.', 160);
        assert.match(summary, /개발|설계/);
        assert.ok(summary.length <= 160);
    });
}

test('긴 문장을 건너뛴 뒤 들어가는 짧은 문장도 선택한다', () => {
    const service = makeService();
    const summary = service.summarizeMultipleSentences(['개발'.repeat(85), '짧은 문장으로 핵심을 설명합니다'], 80);
    assert.match(summary, /짧은 문장/);
    assert.ok(summary.length <= 80);
});

test('자연스러운 요약 절단과 문장 연결도 요청 길이를 넘지 않는다', () => {
    const service = makeService();
    const sentence = '개발'.repeat(78) + 'x ' + '구현'.repeat(10);
    assert.ok(service.formatSingleSentence(sentence, 160).length <= 160, '절단 뒤 말줄임표까지 160자 이하여야 한다');
    const summary = service.summarizeMultipleSentences([sentence, '설계'.repeat(85)], 160);
    assert.match(summary, /개발/);
    assert.ok(summary.length <= 160);
    for (const limit of [80, 160]) {
        const joined = service.summarizeMultipleSentences(['개발 구현으로 문제를 해결했습니다'.repeat(2), '추가로 테스트를 진행했습니다'.repeat(2)], limit);
        assert.ok(joined.length <= limit);
    }
});

for (const failedAi of [false, true]) {
    test(`AI ${failedAi ? '실패' : '미설정'} 기본 키워드에도 요청 개수 제한을 적용한다`, async () => {
        const service = makeService();
        if (failedAi) service.model = { generateContent: async () => { throw new Error('AI 실패'); } };
        assert.deepEqual(await service.extractKeywords('1234567890'.repeat(6), 1), ['기술']);
        assert.deepEqual(await service.extractKeywords('1234567890'.repeat(6), 2), ['기술', '개발']);
        assert.ok((await service.extractKeywords('React 개발 내용입니다', 1)).length <= 1);
    });
}
