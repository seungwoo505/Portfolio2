const test = require('node:test');
const assert = require('node:assert/strict');
const { createNoopLogger, stubRootModule } = require('./helpers/module-loader');

stubRootModule(['services', 'gemini-ai', 'common.ts'], { logger: createNoopLogger(), verboseDebug: () => {} });
stubRootModule(['db.ts'], { execute: async () => [[]] });
const markdown = require('../services/gemini-ai/markdown.ts');
const summaries = require('../services/gemini-ai/summary.ts');
const keywords = require('../services/gemini-ai/keywords.ts');

const restore = ({ cleanText, protectedTerms }) => Object.entries(protectedTerms).reduce(
    (text, [token, term]) => text.replaceAll(token, term), cleanText
);

test('마크다운 제거 후에도 기술명 보호 표식을 원래 기술명으로 복원할 수 있다', async () => {
    const result = await markdown.cleanMarkdownWithProtection('**Next.js**와 `TypeScript`를 사용합니다.');
    assert.equal(restore(result), 'Next.js와 TypeScript를 사용합니다.');
});

test('짧거나 겹치는 기술 태그가 다른 기술명의 보호 표식을 훼손하지 않는다', async () => {
    const result = await markdown.cleanMarkdownWithProtection(
        'Next.js와 my_library 그리고 C를 사용합니다.', ['C', 'Next', 'my_library']
    );
    assert.equal(restore(result), 'Next.js와 my_library 그리고 C를 사용합니다.');
});

test('AI가 보호된 입력을 반환해도 요약 결과에는 원래 기술명이 표시된다', async () => {
    const service = {
        ...markdown,
        model: {
            generateContent: async prompt => ({ response: {
                text: () => prompt.split('텍스트:\n')[1].split('\n\n요약:')[0]
            } })
        },
        fallbackSummary: () => '예상하지 않은 fallback'
    };
    const summary = await summaries.generateSummary.call(service, 'Next.js와 TypeScript로 API를 구현했습니다.', 160);
    assert.equal(summary, 'Next.js와 TypeScript로 API를 구현했습니다.');
});

test('같은 기술명이 반복되어도 AI에 보내는 복원 사전은 한 항목만 사용한다', async () => {
    const result = await markdown.cleanMarkdownWithProtection('Next.js '.repeat(100));
    assert.equal(Object.values(result.protectedTerms).filter(term => term === 'Next.js').length, 1);
    assert.equal(restore(result), 'Next.js '.repeat(100).trim());
});

test('복원된 Next.js 기술명이 키워드 정리 단계에서도 유지된다', async () => {
    const service = {
        ...markdown, ...keywords,
        model: {
            generateContent: async prompt => ({ response: {
                text: () => [...prompt.matchAll(/^- (\S+) = (?:Next\.js|TypeScript)$/gm)]
                    .map(match => match[1]).join(', ')
            } })
        },
        fallbackKeywords: () => ['예상하지 않은 fallback']
    };
    const result = await service.extractKeywords('Next.js와 TypeScript를 사용해 웹 애플리케이션의 다양한 기능을 구현하고 성능과 안정성을 개선했습니다.', 10);
    assert.deepEqual(result, ['Next.js', 'TypeScript']);
});

test('AI가 원래 기술명을 응답해도 하이픈과 선행 마침표를 보존한다', async () => {
    const service = {
        ...markdown, ...keywords,
        model: { generateContent: async () => ({ response: {
            text: () => 'GPT-4, scikit-learn, .NET, CI/CD'
        } }) },
        fallbackKeywords: () => { throw new Error('정상 AI 응답을 fallback으로 처리하면 안 됩니다.'); }
    };
    const result = await service.extractKeywords(
        'GPT-4와 scikit-learn 및 .NET을 이용해 분류 모델을 개발하고 CI/CD 배포 파이프라인의 안정성을 개선했습니다.',
        10, ['GPT-4', 'scikit-learn', '.NET', 'CI/CD']
    );
    assert.deepEqual(result, ['GPT-4', 'scikit-learn', '.NET', 'CI/CD']);
});

test('번호와 글머리표를 제거하면서 숫자로 시작하는 기술명을 보존한다', () => {
    const result = keywords.parseAndCleanKeywords.call(keywords,
        '1. .NET\n2) GPT-4\n- scikit-learn\n* 3D 그래픽\n+ C++', 10);
    assert.deepEqual(result, ['.NET', 'GPT-4', 'scikit-learn', '3D 그래픽', 'C++']);
});

test('쉼표가 포함된 보호된 기술명도 하나의 키워드로 복원한다', async () => {
    const service = {
        ...markdown, ...keywords,
        model: { generateContent: async prompt => ({ response: {
            text: () => {
                const tokens = new Map([...prompt.matchAll(/^- (\S+) = (.+)$/gm)]
                    .map(match => [match[2], match[1]]));
                return ['C, C++', '.NET', 'GPT-4'].map(term => tokens.get(term)).join(', ');
            }
        } }) },
        fallbackKeywords: () => { throw new Error('보호된 기술명을 fallback으로 처리하면 안 됩니다.'); }
    };
    const result = await service.extractKeywords(
        'C, C++와 .NET 및 GPT-4를 사용해 프로그램을 구현하고 안정성과 성능을 개선하는 과정을 정리했습니다.',
        3, ['C, C++', '.NET', 'GPT-4']
    );
    assert.deepEqual(result, ['C, C++', '.NET', 'GPT-4']);
});

test('기술명의 보호 표식과 원문이 함께 응답되어도 중복을 제거한다', async () => {
    const service = {
        ...markdown, ...keywords,
        model: { generateContent: async prompt => ({ response: {
            text: () => {
                const token = prompt.match(/^- (\S+) = Next\.js$/m)[1];
                return `${token}, Next.js, TypeScript`;
            }
        } }) },
        fallbackKeywords: () => { throw new Error('중복 정리에 fallback을 사용하면 안 됩니다.'); }
    };
    const result = await service.extractKeywords(
        'Next.js와 TypeScript를 이용해 웹 애플리케이션을 구현하고 개발과 배포 과정을 자동화하여 안정성과 성능을 개선했습니다.', 10
    );
    assert.deepEqual(result, ['Next.js', 'TypeScript']);
});
