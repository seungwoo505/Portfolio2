const test = require('node:test');
const assert = require('node:assert/strict');
const {
    postJson,
    requestJson,
    startRouterServer,
    waitFor
} = require('./helpers/http-route-server');
const { createCacheStub } = require('./helpers/cache-stub');
const { loadPublicRoute } = require('./helpers/public-route-loader');

test('public contact rejects duplicate submissions before creating another message', async () => {
    const createdPayloads = [];
    const router = loadPublicRoute({
        CacheUtils: createCacheStub(),
        ContactMessages: {
            createWithRateLimit: async (payload) => {
                createdPayloads.push(payload);
                return 42;
            }
        }
    });
    const body = {
        name: '홍길동',
        email: 'person@example.com',
        subject: '문의',
        message: '같은 문의입니다.'
    };

    const first = await requestJson(router, '/contact', { method: 'POST', body });
    const second = await requestJson(router, '/contact', { method: 'POST', body });

    assert.equal(first.status, 201);
    assert.equal(second.status, 409);
    assert.equal(second.body.message, '같은 문의가 이미 접수되었습니다.');
    assert.equal(createdPayloads.length, 1);
    assert.equal(createdPayloads[0].email, 'person@example.com');
    assert.equal(createdPayloads[0].message, '같은 문의입니다.');
});

test('public contact claims duplicate key before create completes', async () => {
    const createdPayloads = [];
    let resolveCreate;
    const createBlock = new Promise((resolve) => {
        resolveCreate = resolve;
    });
    const router = loadPublicRoute({
        CacheUtils: createCacheStub(),
        ContactMessages: {
            createWithRateLimit: async (payload) => {
                createdPayloads.push(payload);
                await createBlock;
                return 42;
            }
        }
    });
    const body = {
        name: '홍길동',
        email: 'person@example.com',
        subject: '문의',
        message: '동시 문의입니다.'
    };
    const server = await startRouterServer(router, { json: true });

    try {
        const first = postJson(server.baseUrl, '/contact', body);
        await waitFor(() => createdPayloads.length === 1);
        const second = await postJson(server.baseUrl, '/contact', body);

        assert.equal(second.status, 409);
        assert.equal(createdPayloads.length, 1);

        resolveCreate();
        const firstResult = await first;

        assert.equal(firstResult.status, 201);
        assert.equal(createdPayloads.length, 1);
    } finally {
        resolveCreate?.();
        await server.close();
    }
});

const validContact = { name: '홍길동', email: 'person@example.com', subject: '문의', message: '협업 문의입니다.' };
for (const field of ['name', 'email', 'subject', 'message']) {
    for (const [label, value] of Object.entries({ object: {}, array: [validContact[field]], number: 123, boolean: true, invalidToString: { toString: null } })) {
        test(`public contact: ${field}의 ${label} 입력은 저장 전에 400으로 거절한다`, async () => {
            const created = [];
            const router = loadPublicRoute({ ContactMessages: {
                createWithRateLimit: async payload => { created.push(payload); return 42; }
            } });
            const result = await requestJson(router, '/contact', {
                method: 'POST', body: { ...validContact, [field]: value }
            });
            assert.equal(result.status, 400);
            assert.equal(created.length, 0);
        });
    }
}

for (const subject of [undefined, null, '   ']) {
    test(`public contact: 선택 제목 ${JSON.stringify(subject)}은 NULL로 저장하고 문자열을 정규화한다`, async () => {
        const created = [];
        const router = loadPublicRoute({ ContactMessages: {
            createWithRateLimit: async payload => { created.push(payload); return 42; }
        } });
        const result = await requestJson(router, '/contact', { method: 'POST', body: {
            ...validContact, name: ' 홍길동 ', email: ' Person@Example.com ', message: ' 협업 문의입니다. ', subject
        } });
        assert.equal(result.status, 201);
        assert.deepEqual([created[0].name, created[0].email, created[0].subject, created[0].message],
            ['홍길동', 'person@example.com', null, '협업 문의입니다.']);
    });
}
