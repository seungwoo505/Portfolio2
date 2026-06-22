const test = require('node:test');
const assert = require('node:assert/strict');
const { loadAdminRoute, requestJson } = require('./helpers/admin-route-loader');

test('admin contact read maps missing messages to 404 before update', async () => {
    let markAsReadCalled = false;
    const router = loadAdminRoute(['routes', 'admin', 'contacts.ts'], [{
        segments: ['models', 'contact-messages.ts'],
        moduleExports: {
            getById: async () => null,
            markAsRead: async () => {
                markAsReadCalled = true;
                return { id: 3 };
            }
        }
    }]);

    const { status, body } = await requestJson(router, '/contacts/3/read', {
        method: 'PUT'
    });

    assert.equal(status, 404);
    assert.equal(body.message, '메시지를 찾을 수 없습니다.');
    assert.equal(markAsReadCalled, false);
});

test('admin contact list rejects invalid unread filters before model calls', async () => {
    let getAllCalled = false;
    let getUnreadCalled = false;
    const router = loadAdminRoute(['routes', 'admin', 'contacts.ts'], [{
        segments: ['models', 'contact-messages.ts'],
        moduleExports: {
            getAll: async () => {
                getAllCalled = true;
                return [];
            },
            getUnread: async () => {
                getUnreadCalled = true;
                return [];
            },
            countAll: async () => 0
        }
    }]);

    const { status, body } = await requestJson(router, '/contacts?unread=maybe');

    assert.equal(status, 400);
    assert.equal(body.message, 'unread 값은 boolean이어야 합니다.');
    assert.equal(getAllCalled, false);
    assert.equal(getUnreadCalled, false);
});
