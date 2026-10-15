const test = require('node:test');
const assert = require('node:assert/strict');
const {
    loadSkillsRoute,
    requestJson
} = require('./helpers/skills-route-loader');

for (const action of ['order', 'featured']) {
    test(`기술 ${action} PATCH도 다른 추천 기술과 순서가 겹치면 거절한다`, async () => {
        let saved = false;
        const checks = [];
        const router = loadSkillsRoute({
            getSkillById: async () => ({ id: 9, display_order: 7, is_featured: action === 'order' }),
            getByDisplayOrder: async (...args) => { checks.push(args); return { id: 10 }; },
            updateSkill: async () => { saved = true; }
        });
        const response = await requestJson(router, `/skills/9/${action}`, {
            method: 'PATCH', body: action === 'order' ? { display_order: 7 } : { is_featured: true }
        });
        assert.equal(response.status, 400);
        assert.match(response.body.message, /이미 사용 중/);
        assert.deepEqual(checks, [[7, 9]]);
        assert.equal(saved, false);
    });

    test(`기술 ${action} PATCH는 자신을 제외한 충돌이 없으면 저장한다`, async () => {
        let saved = false;
        const router = loadSkillsRoute({
            getSkillById: async () => ({ id: 9, display_order: 7, is_featured: 1 }),
            getByDisplayOrder: async (order, excludeId) => { assert.equal(excludeId, 9); return null; },
            updateSkill: async () => { saved = true; }
        });
        const response = await requestJson(router, `/skills/9/${action}`, {
            method: 'PATCH', body: action === 'order' ? { display_order: 7 } : { is_featured: true }
        });
        assert.equal(response.status, 200);
        assert.equal(saved, true);
    });
}

test('admin skills featured toggle normalizes boolean-like strings', async () => {
    const updatedPayloads = [];
    const router = loadSkillsRoute({
        getSkillById: async (id) => ({ id }),
        updateSkill: async (_id, payload) => {
            updatedPayloads.push(payload);
        }
    });

    const { status } = await requestJson(router, '/skills/9/featured', {
        method: 'PATCH',
        body: {
            is_featured: 'false'
        }
    });

    assert.equal(status, 200);
    assert.deepEqual(updatedPayloads, [{ is_featured: false }]);
});

test('admin skills order update normalizes numeric strings', async () => {
    const updatedPayloads = [];
    const router = loadSkillsRoute({
        getSkillById: async (id) => ({ id }),
        updateSkill: async (_id, payload) => {
            updatedPayloads.push(payload);
        }
    });

    const { status } = await requestJson(router, '/skills/9/order', {
        method: 'PATCH',
        body: {
            display_order: '7'
        }
    });

    assert.equal(status, 200);
    assert.deepEqual(updatedPayloads, [{ display_order: 7 }]);
});

test('admin skills order update rejects partially numeric values before model calls', async () => {
    let getSkillByIdCalled = false;
    let updateCalled = false;
    const router = loadSkillsRoute({
        getSkillById: async () => {
            getSkillByIdCalled = true;
            return { id: 9 };
        },
        updateSkill: async () => {
            updateCalled = true;
        }
    });

    const { status, body } = await requestJson(router, '/skills/9/order', {
        method: 'PATCH',
        body: {
            display_order: '7abc'
        }
    });

    assert.equal(status, 400);
    assert.equal(body.message, '표시 순서는 0 이상의 숫자여야 합니다.');
    assert.equal(getSkillByIdCalled, false);
    assert.equal(updateCalled, false);
});

test('admin skills featured toggle rejects invalid ids before model calls', async () => {
    let getSkillByIdCalled = false;
    let updateCalled = false;
    const router = loadSkillsRoute({
        getSkillById: async () => {
            getSkillByIdCalled = true;
            return { id: 9 };
        },
        updateSkill: async () => {
            updateCalled = true;
        }
    });

    const { status, body } = await requestJson(router, '/skills/not-a-number/featured', {
        method: 'PATCH',
        body: {
            is_featured: 'true'
        }
    });

    assert.equal(status, 400);
    assert.equal(body.message, '유효한 기술 스택 ID가 필요합니다.');
    assert.equal(getSkillByIdCalled, false);
    assert.equal(updateCalled, false);
});

test('admin skills order update maps missing skills to 404', async () => {
    let updateCalled = false;
    const router = loadSkillsRoute({
        getSkillById: async () => null,
        updateSkill: async () => {
            updateCalled = true;
        }
    });

    const { status, body } = await requestJson(router, '/skills/9/order', {
        method: 'PATCH',
        body: {
            display_order: '7'
        }
    });

    assert.equal(status, 404);
    assert.equal(body.message, '기술 스택을 찾을 수 없습니다.');
    assert.equal(updateCalled, false);
});
