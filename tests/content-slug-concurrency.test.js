const test = require('node:test');
const assert = require('node:assert/strict');
const { createAtomicModelFixture } = require('./helpers/atomic-model-fixture');
const { loadAdminRoute, requestJson } = require('./helpers/admin-route-loader');

const families = [
    { family: 'projects', table: 'projects', route: 'projects', url: '/projects', data: { title: '같은 제목', description: '설명' }, slug: '같은-제목', limit: 255 },
    { family: 'blog-posts', table: 'blog_posts', route: 'blog', url: '/blog/posts', data: { title: '같은 제목', content: '내용' }, slug: '같은-제목', limit: 255 },
    { family: 'tags', table: 'tags', route: 'tags', url: '/tags', data: { name: '같은 이름' }, slug: '같은-이름', limit: 120 }
];

for (const entry of families) {
    // check→INSERT 사이의 경합을 놓치면 두 정상 요청 중 하나가 500이 된다.
    test(`${entry.family}: 동시 POST는 slug UNIQUE 충돌 후 두 레코드를 생성한다`, { timeout: 15000 }, async () => {
        const fixture = createAtomicModelFixture({ table: entry.table, barrier: true });
        const model = fixture.loadModel(entry.family);
        const router = loadAdminRoute(['routes', 'admin', `${entry.route}.ts`], [{ segments: ['models', `${entry.family}.ts`], moduleExports: model }]);
        const responses = await Promise.all([1, 2].map(() => requestJson(router, entry.url, { method: 'POST', body: entry.data })));
        assert.deepEqual(responses.map(response => response.status), [201, 201]);
        assert.equal(fixture.barrierCount, 2);
        assert.deepEqual([...fixture.rows.values()].map(row => row.slug).sort(), [entry.slug, entry.slug + '-1']);
        assert.deepEqual(responses.map(response => response.body.data.slug).sort(), [entry.slug, entry.slug + '-1']);
        if (entry.family !== 'tags') {
            assert.equal(fixture.connections.reduce((sum, connection) => sum + connection.rollbacks, 0), 1);
            assert.equal(fixture.connections.reduce((sum, connection) => sum + connection.commits, 0), 2);
        }
    });

    test(`${entry.family}: 명시한 최대 길이 slug도 중복 시 길이를 보존해 생성한다`, async () => {
        const fixture = createAtomicModelFixture({ table: entry.table, rows: [{ id: 1, slug: 'a'.repeat(entry.limit) }] });
        const model = fixture.loadModel(entry.family);
        await model.create({ ...entry.data, slug: 'a'.repeat(entry.limit) });
        assert.equal(fixture.rows.get(2).slug, 'a'.repeat(entry.limit - 2) + '-1');
    });

    for (const key of ['uuid', 'name', 'other.slug']) {
        test(`${entry.family}: ${key} UNIQUE 오류는 slug 충돌로 재시도하지 않는다`, async () => {
            const error = Object.assign(new Error(`Duplicate entry 'value' for key '${key}'`), { code: 'ER_DUP_ENTRY' });
            const fixture = createAtomicModelFixture({ table: entry.table, insertFailure: error });
            const model = fixture.loadModel(entry.family);
            await assert.rejects(model.create(entry.data), failure => failure === error);
            assert.equal(fixture.calls.filter(call => call.sql.startsWith(`insert into ${entry.table} `)).length, 1);
            assert.equal(fixture.rows.size, 0);
        });
    }

    test(`${entry.family}: 계속되는 slug UNIQUE 충돌은 제한된 횟수 후 원래 오류로 실패한다`, async () => {
        const error = Object.assign(new Error(`Duplicate entry 'value' for key 'slug'`), { code: 'ER_DUP_ENTRY' });
        const fixture = createAtomicModelFixture({ table: entry.table, insertFailure: error });
        const model = fixture.loadModel(entry.family);
        await assert.rejects(model.create(entry.data), failure => failure === error);
        assert.equal(fixture.calls.filter(call => call.sql.startsWith(`insert into ${entry.table} `)).length, 3);
        assert.equal(fixture.rows.size, 0);
    });

    if (entry.family !== 'tags') {
        test(`${entry.family}: 후속 태그 slug 충돌은 본문을 재시도하지 않고 롤백한다`, async () => {
            const error = Object.assign(new Error("Duplicate entry 'tag' for key 'slug'"), { code: 'ER_DUP_ENTRY' });
            const fixture = createAtomicModelFixture({ table: entry.table, queryFailure: { match: 'insert into tags ', error } });
            const model = fixture.loadModel(entry.family);
            await assert.rejects(model.create({ ...entry.data, tags: ['태그'] }), failure => failure === error);
            assert.equal(fixture.calls.filter(call => call.sql.startsWith(`insert into ${entry.table} `)).length, 1);
            assert.equal(fixture.rows.size, 0);
            assert.equal(fixture.connections.reduce((sum, connection) => sum + connection.rollbacks, 0), 1);
        });
    }
}
