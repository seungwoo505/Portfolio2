const test = require('node:test');
const assert = require('node:assert/strict');
const { createContentTagFixture } = require('./helpers/content-tag-fixture');
const { loadAdminRoute, requestJson } = require('./helpers/admin-route-loader');

const cases = [
    { family: 'projects', route: 'projects', path: '/projects', create: 'create', update: 'update' },
    { family: 'blog-posts', route: 'blog', path: '/blog/posts', create: '_create', update: '_update' }
];
const content = { title: 'demo', slug: 'demo', description: '설명', content: '본문' };
const invalidTags = [{ name: 'replacement' }, false, 12, ['정상', { name: '잘못된 태그' }], ['정상', null]];
const routerFor = ({ family, route }, model) => loadAdminRoute(['routes', 'admin', route + '.ts'], [
    { segments: ['models', family + '.ts'], moduleExports: model }
]);

for (const scenario of cases) {
    const { family, path, create, update } = scenario;
    for (const tags of invalidTags) {
        const label = JSON.stringify(tags);
        test(`${family}: PUT의 잘못된 tags ${label}은 400이며 기존 태그와 본문을 보존한다`, async () => {
            const { model } = createContentTagFixture(family);
            const id = await model[create]({ ...content, tags: ['keep-tag'] });
            const result = await requestJson(routerFor(scenario, model), path + '/slug/demo', {
                method: 'PUT', body: { content: '바뀌면 안 되는 본문', tags }
            });
            assert.equal(result.status, 400);
            const saved = await model.getById(id);
            assert.equal(saved.content, '본문');
            assert.deepEqual(saved.tags.map(tag => tag.name), ['keep-tag']);
        });

        test(`${family}: POST의 잘못된 tags ${label}은 새 콘텐츠를 저장하지 않는다`, async () => {
            const { model, rows } = createContentTagFixture(family);
            const result = await requestJson(routerFor(scenario, model), path, {
                method: 'POST', body: { ...content, tags }
            });
            assert.equal(result.status, 400);
            assert.equal(rows.length, 0);
        });
    }

    for (const operation of ['create', 'update', 'updateTags']) {
        test(`${family}: 직접 ${operation}도 잘못된 태그를 어떤 쓰기보다 먼저 거절한다`, async () => {
            const fixture = createContentTagFixture(family);
            const { model, rows, operations } = fixture;
            const id = await model[create]({ ...content, tags: ['keep-tag'] });
            operations.length = 0;
            const tags = { name: 'replacement' };
            const action = operation === 'create' ? () => model[create]({ ...content, tags })
                : operation === 'update' ? () => model[update](id, { content: '변경', tags })
                    : () => model.updateTags(id, tags);
            await assert.rejects(action, { code: 'INVALID_TAG_NAMES' });
            assert.equal(operations.some(item => /(?:insert|update|delete) /.test(item.sql)), false);
            assert.equal(rows.length, 1);
            assert.equal((await model.getById(id)).content, '본문');
            assert.deepEqual((await model.getById(id)).tags.map(tag => tag.name), ['keep-tag']);
        });
    }

    for (const tags of [[], null, ['설계, 구현'], 'backend, node']) {
        test(`${family}: PUT은 지원하던 tags ${JSON.stringify(tags)} 입력을 유지한다`, async () => {
            const { model } = createContentTagFixture(family);
            const id = await model[create]({ ...content, tags: ['keep-tag'] });
            const result = await requestJson(routerFor(scenario, model), path + '/slug/demo', {
                method: 'PUT', body: { tags }
            });
            assert.equal(result.status, 200);
            const want = tags === null || tags.length === 0 ? []
                : typeof tags === 'string' ? ['backend', 'node'] : ['설계, 구현'];
            assert.deepEqual((await model.getById(id)).tags.map(tag => tag.name), want);
        });
    }
}
