const test = require('node:test');
const assert = require('node:assert/strict');
const {
    loadAuthRoute,
    requestJson
} = require('./helpers/admin-auth-route-loader');

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
