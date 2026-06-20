const test = require('node:test');
const assert = require('node:assert/strict');
const {
    loadUsersRoute,
    requestJson
} = require('./helpers/admin-auth-route-loader');

test('admin user create trims and validates payload before model call', async () => {
    const createdPayloads = [];
    const router = loadUsersRoute({
        create: async (payload) => {
            createdPayloads.push(payload);
            return 2;
        },
        getById: async (id) => ({ id })
    });

    const { status } = await requestJson(router, '/users', {
        method: 'POST',
        body: {
            username: '  editor  ',
            email: '  editor@example.com  ',
            password: 'StrongPass123',
            full_name: '  Editor User  ',
            role: 'editor'
        }
    });

    assert.equal(status, 201);
    assert.deepEqual(createdPayloads, [{
        username: 'editor',
        email: 'editor@example.com',
        password: 'StrongPass123',
        full_name: 'Editor User',
        role: 'editor'
    }]);
});

test('admin user create rejects invalid roles before model call', async () => {
    let createCalled = false;
    const router = loadUsersRoute({
        create: async () => {
            createCalled = true;
        }
    });

    const { status, body } = await requestJson(router, '/users', {
        method: 'POST',
        body: {
            username: 'owner',
            email: 'owner@example.com',
            password: 'StrongPass123',
            role: 'owner'
        }
    });

    assert.equal(status, 400);
    assert.equal(body.message, '관리자 역할이 올바르지 않습니다.');
    assert.equal(createCalled, false);
});

test('admin user create preserves duplicate account errors', async () => {
    const router = loadUsersRoute({
        create: async () => {
            throw new Error('이미 존재하는 사용자명 또는 이메일입니다.');
        }
    });

    const { status, body } = await requestJson(router, '/users', {
        method: 'POST',
        body: {
            username: 'editor',
            email: 'editor@example.com',
            password: 'StrongPass123',
            role: 'editor'
        }
    });

    assert.equal(status, 400);
    assert.equal(body.message, '이미 존재하는 사용자명 또는 이메일입니다.');
});

test('admin user create hides unexpected internal errors', async () => {
    const router = loadUsersRoute({
        create: async () => {
            throw new Error('database connection string leaked');
        }
    });

    const { status, body } = await requestJson(router, '/users', {
        method: 'POST',
        body: {
            username: 'editor',
            email: 'editor@example.com',
            password: 'StrongPass123',
            role: 'editor'
        }
    });

    assert.equal(status, 500);
    assert.equal(body.message, '관리자 생성에 실패했습니다.');
    assert.equal(Object.prototype.hasOwnProperty.call(body, 'error'), false);
});

test('admin user update normalizes boolean-like active status', async () => {
    const updatedPayloads = [];
    const router = loadUsersRoute({
        getById: async (id) => ({ id }),
        update: async (_id, payload) => {
            updatedPayloads.push(payload);
            return { id: 5 };
        }
    });

    const { status } = await requestJson(router, '/users/5', {
        method: 'PUT',
        body: {
            email: '  active@example.com  ',
            is_active: 'false'
        }
    });

    assert.equal(status, 200);
    assert.deepEqual(updatedPayloads, [{
        email: 'active@example.com',
        is_active: false
    }]);
});

test('admin user update forwards strong password changes', async () => {
    const updatedPayloads = [];
    const router = loadUsersRoute({
        getById: async (id) => ({ id }),
        update: async (_id, payload) => {
            updatedPayloads.push(payload);
            return { id: 5 };
        }
    });

    const { status } = await requestJson(router, '/users/5', {
        method: 'PUT',
        body: {
            password: 'NewStrongPass123'
        }
    });

    assert.equal(status, 200);
    assert.deepEqual(updatedPayloads, [{
        password: 'NewStrongPass123'
    }]);
});

test('admin user update rejects weak passwords before model call', async () => {
    let updateCalled = false;
    const router = loadUsersRoute({
        getById: async (id) => ({ id }),
        update: async () => {
            updateCalled = true;
            return { id: 5 };
        }
    });

    const { status, body } = await requestJson(router, '/users/5', {
        method: 'PUT',
        body: {
            password: 'short'
        }
    });

    assert.equal(status, 400);
    assert.equal(body.message, '비밀번호는 최소 12자 이상이어야 합니다.');
    assert.equal(updateCalled, false);
});

test('admin user update rejects invalid ids before model calls', async () => {
    let getByIdCalled = false;
    let updateCalled = false;
    const router = loadUsersRoute({
        getById: async () => {
            getByIdCalled = true;
            return { id: 5 };
        },
        update: async () => {
            updateCalled = true;
            return { id: 5 };
        }
    });

    const { status, body } = await requestJson(router, '/users/not-a-number', {
        method: 'PUT',
        body: {
            email: 'active@example.com'
        }
    });

    assert.equal(status, 400);
    assert.equal(body.message, '유효한 사용자 ID가 필요합니다.');
    assert.equal(getByIdCalled, false);
    assert.equal(updateCalled, false);
});

test('admin user update maps missing users to 404 before update', async () => {
    let updateCalled = false;
    const router = loadUsersRoute({
        getById: async () => null,
        update: async () => {
            updateCalled = true;
            return { id: 5 };
        }
    });

    const { status, body } = await requestJson(router, '/users/5', {
        method: 'PUT',
        body: {
            email: 'active@example.com'
        }
    });

    assert.equal(status, 404);
    assert.equal(body.message, '사용자를 찾을 수 없습니다.');
    assert.equal(updateCalled, false);
});
