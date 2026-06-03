const test = require('node:test');
const assert = require('node:assert/strict');
const { loadAdminRoute, requestJson } = require('./helpers/admin-route-loader');

test('admin social link create trims required strings before model call', async () => {
    const createdPayloads = [];
    const router = loadAdminRoute(['routes', 'admin', 'profile.js'], [
        {
            segments: ['models', 'personal-info.js'],
            moduleExports: {}
        },
        {
            segments: ['models', 'social-links.js'],
            moduleExports: {
                create: async (payload) => {
                    createdPayloads.push(payload);
                    return 11;
                },
                getById: async (id) => ({ id })
            }
        }
    ]);

    const { status } = await requestJson(router, '/social-links', {
        method: 'POST',
        body: {
            platform: '  GitHub  ',
            url: '  https://github.com/example  '
        }
    });

    assert.equal(status, 201);
    assert.deepEqual(createdPayloads, [{
        platform: 'GitHub',
        url: 'https://github.com/example'
    }]);
});

test('admin social link update maps missing links to 404 before update', async () => {
    let updateCalled = false;
    const router = loadAdminRoute(['routes', 'admin', 'profile.js'], [
        {
            segments: ['models', 'personal-info.js'],
            moduleExports: {}
        },
        {
            segments: ['models', 'social-links.js'],
            moduleExports: {
                getById: async () => null,
                update: async () => {
                    updateCalled = true;
                    return { id: 11 };
                }
            }
        }
    ]);

    const { status, body } = await requestJson(router, '/social-links/11', {
        method: 'PUT',
        body: {
            platform: 'GitHub'
        }
    });

    assert.equal(status, 404);
    assert.equal(body.message, '소셜 링크를 찾을 수 없습니다.');
    assert.equal(updateCalled, false);
});
