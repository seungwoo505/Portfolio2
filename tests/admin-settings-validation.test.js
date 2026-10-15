const test = require('node:test');
const assert = require('node:assert/strict');
const { loadAdminRoute, requestJson } = require('./helpers/admin-route-loader');

test('설명 생략은 명시적 null과 구분하여 모델에 전달한다', async () => {
    let saved;
    const router = loadAdminRoute(['routes', 'admin', 'settings.ts'], [{
        segments: ['models', 'site-settings.ts'], moduleExports: { setMany: async settings => { saved = settings; } }
    }]);
    const result = await requestJson(router, '/settings', {
        method: 'PUT', body: { settings: { unchanged: { value: 'a' }, cleared: { value: 'b', description: null } } }
    });
    assert.equal(result.status, 200);
    assert.equal(saved.unchanged.description, undefined);
    assert.equal(saved.cleared.description, null);
});

test('기존 설정 타입의 유효성 오류는 400으로 반환한다', async () => {
    const router = loadAdminRoute(['routes', 'admin', 'settings.ts'], [{
        segments: ['models', 'site-settings.ts'],
        moduleExports: { setMany: async () => {
            const error = new Error('page_size 설정 값은 숫자여야 합니다.');
            error.code = 'INVALID_SETTING_VALUE';
            throw error;
        } }
    }]);
    const result = await requestJson(router, '/settings', {
        method: 'PUT', body: { settings: { page_size: { value: ' ' } } }
    });
    assert.equal(result.status, 400);
    assert.equal(result.body.message, 'page_size 설정 값은 숫자여야 합니다.');
});

test('admin settings update normalizes setting configs before model calls', async () => {
    const savedPayloads = [];
    const router = loadAdminRoute(['routes', 'admin', 'settings.ts'], [{
        segments: ['models', 'site-settings.ts'],
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
            description: undefined
        },
        feature_enabled: {
            value: false,
            type: 'boolean',
            is_public: undefined,
            description: undefined
        }
    }]);
});

test('admin settings update rejects oversized keys before model calls', async () => {
    let setManyCalled = false;
    const router = loadAdminRoute(['routes', 'admin', 'settings.ts'], [{
        segments: ['models', 'site-settings.ts'],
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
    const router = loadAdminRoute(['routes', 'admin', 'settings.ts'], [{
        segments: ['models', 'site-settings.ts'],
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
