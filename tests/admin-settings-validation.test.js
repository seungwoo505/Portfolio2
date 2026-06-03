const test = require('node:test');
const assert = require('node:assert/strict');
const { loadAdminRoute, requestJson } = require('./helpers/admin-route-loader');

test('admin settings update normalizes setting configs before model calls', async () => {
    const savedPayloads = [];
    const router = loadAdminRoute(['routes', 'admin', 'settings.js'], [{
        segments: ['models', 'site-settings.js'],
        moduleExports: {
            setMany: async (settings) => {
                savedPayloads.push(settings);
            }
        }
    }]);

    const { status } = await requestJson(router, '/settings', {
        method: 'PUT',
        body: {
            settings: {
                ' site_title ': {
                    value: 'Portfolio',
                    type: 'STRING',
                    is_public: 'true',
                    description: '  공개 제목  '
                },
                max_items: {
                    value: '3',
                    type: 'number',
                    is_public: false
                },
                feature_enabled: {
                    value: 'false',
                    type: 'boolean'
                }
            }
        }
    });

    assert.equal(status, 200);
    assert.deepEqual(savedPayloads, [{
        site_title: {
            value: 'Portfolio',
            type: 'string',
            is_public: true,
            description: '공개 제목'
        },
        max_items: {
            value: 3,
            type: 'number',
            is_public: false,
            description: null
        },
        feature_enabled: {
            value: false,
            type: 'boolean',
            is_public: undefined,
            description: null
        }
    }]);
});

test('admin settings update rejects oversized keys before model calls', async () => {
    let setManyCalled = false;
    const router = loadAdminRoute(['routes', 'admin', 'settings.js'], [{
        segments: ['models', 'site-settings.js'],
        moduleExports: {
            setMany: async () => {
                setManyCalled = true;
            }
        }
    }]);

    const { status, body } = await requestJson(router, '/settings', {
        method: 'PUT',
        body: {
            settings: {
                [String('a').repeat(121)]: {
                    value: 'too long'
                }
            }
        }
    });

    assert.equal(status, 400);
    assert.equal(body.message, '설정 key는 1자 이상 120자 이하여야 합니다.');
    assert.equal(setManyCalled, false);
});

test('admin settings update rejects blank numeric values before model calls', async () => {
    let setManyCalled = false;
    const router = loadAdminRoute(['routes', 'admin', 'settings.js'], [{
        segments: ['models', 'site-settings.js'],
        moduleExports: {
            setMany: async () => {
                setManyCalled = true;
            }
        }
    }]);

    const { status, body } = await requestJson(router, '/settings', {
        method: 'PUT',
        body: {
            settings: {
                max_items: {
                    value: ' ',
                    type: 'number'
                }
            }
        }
    });

    assert.equal(status, 400);
    assert.equal(body.message, 'max_items 설정 값은 숫자여야 합니다.');
    assert.equal(setManyCalled, false);
});
