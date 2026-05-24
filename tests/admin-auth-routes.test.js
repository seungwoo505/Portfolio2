const test = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');

const {
    clearRootModules,
    createNoopLogger,
    resolveFromRoot,
    stubRootModule
} = require('./helpers/module-loader');

const requestJson = async (router, path, { method = 'GET', body = null } = {}) => {
    const app = express();
    app.use(express.json());
    app.use(router);

    const server = await new Promise((resolve) => {
        const activeServer = app.listen(0, '127.0.0.1', () => resolve(activeServer));
    });

    try {
        const { port } = server.address();
        const response = await fetch(`http://127.0.0.1:${port}${path}`, {
            method,
            headers: body ? { 'Content-Type': 'application/json' } : undefined,
            body: body ? JSON.stringify(body) : undefined
        });
        return {
            status: response.status,
            body: await response.json()
        };
    } finally {
        await new Promise((resolve, reject) => {
            server.close((error) => (error ? reject(error) : resolve()));
        });
    }
};

const stubCommon = () => {
    stubRootModule(['routes', 'admin', 'common.js'], {
        logger: createNoopLogger(),
        buildErrorLog: (error) => ({ error: error.message })
    });
};

const stubAuthMiddleware = () => {
    stubRootModule(['middleware', 'auth.js'], {
        authenticateToken: (req, _res, next) => {
            req.admin = {
                id: 1,
                username: 'root',
                role: 'super_admin',
                sessionId: 'session-1'
            };
            next();
        },
        logActivity: () => (_req, _res, next) => next(),
        superAdminOnly: [
            (req, _res, next) => {
                req.admin = {
                    id: 1,
                    username: 'root',
                    role: 'super_admin'
                };
                next();
            }
        ]
    });
};

const loadAuthRoute = ({ AdminUsers, AdminActivityLogs = { log: async () => 0 } }) => {
    clearRootModules([
        ['routes', 'admin', 'auth.js'],
        ['routes', 'admin', 'common.js'],
        ['models', 'admin-users.js'],
        ['models', 'admin-activity-logs.js'],
        ['middleware', 'auth.js'],
        ['log.js']
    ]);

    stubCommon();
    stubAuthMiddleware();
    stubRootModule(['models', 'admin-users.js'], AdminUsers);
    stubRootModule(['models', 'admin-activity-logs.js'], AdminActivityLogs);

    return require(resolveFromRoot(['routes', 'admin', 'auth.js']));
};

const loadUsersRoute = (AdminUsers) => {
    clearRootModules([
        ['routes', 'admin', 'users.js'],
        ['routes', 'admin', 'common.js'],
        ['models', 'admin-users.js'],
        ['middleware', 'auth.js'],
        ['log.js']
    ]);

    stubCommon();
    stubAuthMiddleware();
    stubRootModule(['models', 'admin-users.js'], AdminUsers);

    return require(resolveFromRoot(['routes', 'admin', 'users.js']));
};

test('admin login rejects blank credentials before model call', async () => {
    let loginCalled = false;
    const router = loadAuthRoute({
        AdminUsers: {
            login: async () => {
                loginCalled = true;
            }
        }
    });

    const { status, body } = await requestJson(router, '/login', {
        method: 'POST',
        body: {
            username: '   ',
            password: 'secret'
        }
    });

    assert.equal(status, 400);
    assert.equal(body.message, '사용자명과 비밀번호를 입력해주세요.');
    assert.equal(loginCalled, false);
});

test('admin login returns a generic failure message', async () => {
    const logCalls = [];
    const router = loadAuthRoute({
        AdminUsers: {
            login: async () => {
                throw new Error('사용자를 찾을 수 없습니다.');
            }
        },
        AdminActivityLogs: {
            log: async (...args) => {
                logCalls.push(args);
            }
        }
    });

    const { status, body } = await requestJson(router, '/login', {
        method: 'POST',
        body: {
            username: 'admin',
            password: 'wrong-password'
        }
    });

    assert.equal(status, 401);
    assert.equal(body.message, '사용자명 또는 비밀번호가 올바르지 않습니다.');
    assert.equal(logCalls.length, 1);
});

test('admin refresh returns a generic failure message for invalid tokens', async () => {
    const router = loadAuthRoute({
        AdminUsers: {
            verifyRefreshToken: () => {
                throw new Error('유효하지 않은 Refresh Token입니다.');
            }
        }
    });

    const { status, body } = await requestJson(router, '/refresh', {
        method: 'POST',
        body: {
            refreshToken: 'bad-refresh-token'
        }
    });

    assert.equal(status, 401);
    assert.equal(body.message, 'Refresh Token이 유효하지 않거나 만료되었습니다.');
    assert.equal(Object.prototype.hasOwnProperty.call(body, 'error'), false);
});

test('admin refresh returns a generic failure message for IP mismatches', async () => {
    const router = loadAuthRoute({
        AdminUsers: {
            verifyRefreshToken: () => ({
                id: 1,
                sid: 'session-1',
                ip: '10.0.0.1'
            })
        }
    });

    const { status, body } = await requestJson(router, '/refresh', {
        method: 'POST',
        body: {
            refreshToken: 'refresh-token'
        }
    });

    assert.equal(status, 401);
    assert.equal(body.message, 'Refresh Token이 유효하지 않거나 만료되었습니다.');
});

test('admin password change rejects weak new passwords before model call', async () => {
    let changePasswordCalled = false;
    const router = loadAuthRoute({
        AdminUsers: {
            changePassword: async () => {
                changePasswordCalled = true;
            }
        }
    });

    const { status, body } = await requestJson(router, '/password', {
        method: 'PUT',
        body: {
            oldPassword: 'old-password',
            newPassword: 'short'
        }
    });

    assert.equal(status, 400);
    assert.equal(body.message, '비밀번호는 최소 12자 이상이어야 합니다.');
    assert.equal(changePasswordCalled, false);
});

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

test('admin user update normalizes boolean-like active status', async () => {
    const updatedPayloads = [];
    const router = loadUsersRoute({
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
