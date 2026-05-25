const test = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');

const {
    clearRootModules,
    createNoopLogger,
    resolveFromRoot,
    stubRootModule
} = require('./helpers/module-loader');

const requestJson = async (router, path, { method = 'GET', body = undefined } = {}) => {
    const app = express();
    app.use(express.json({ strict: false }));
    app.use(router);

    const server = await new Promise((resolve) => {
        const activeServer = app.listen(0, '127.0.0.1', () => resolve(activeServer));
    });

    try {
        const { port } = server.address();
        const hasBody = body !== undefined;
        const response = await fetch(`http://127.0.0.1:${port}${path}`, {
            method,
            headers: hasBody ? { 'Content-Type': 'application/json' } : undefined,
            body: hasBody ? JSON.stringify(body) : undefined
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

const loadAiRoute = (geminiService, logger = createNoopLogger()) => {
    const requiredPermissions = [];

    clearRootModules([
        ['routes', 'admin', 'ai.js'],
        ['routes', 'admin', 'common.js'],
        ['services', 'gemini-ai.js'],
        ['middleware', 'auth.js'],
        ['log.js']
    ]);

    stubRootModule(['routes', 'admin', 'common.js'], {
        logger,
        verboseDebug: () => {},
        buildErrorLog: (error) => ({ error: error.message })
    });
    stubRootModule(['services', 'gemini-ai.js'], geminiService);
    stubRootModule(['middleware', 'auth.js'], {
        authenticateToken: (req, _res, next) => {
            req.admin = { id: 1, role: 'super_admin' };
            next();
        },
        requirePermission: (permission) => {
            requiredPermissions.push(permission);
            return (_req, _res, next) => next();
        }
    });

    return {
        router: require(resolveFromRoot(['routes', 'admin', 'ai.js'])),
        requiredPermissions
    };
};

test('admin AI summarize normalizes false-like includeKeywords values', async () => {
    const calls = [];
    const { router, requiredPermissions } = loadAiRoute({
        generateSummary: async (content, maxLength, techTags) => {
            calls.push({ method: 'generateSummary', content, maxLength, techTags });
            return '정규화된 요약';
        },
        generateSummaryAndKeywords: async () => {
            calls.push({ method: 'generateSummaryAndKeywords' });
            return {
                summary: '키워드 포함 요약',
                keywords: ['node'],
                keywordsString: 'node'
            };
        },
        extractKeywords: async () => []
    });

    const { status, body } = await requestJson(router, '/ai/summarize', {
        method: 'POST',
        body: {
            content: '본문 내용',
            includeKeywords: 'false',
            techTags: [' Node.js ']
        }
    });

    assert.equal(status, 200);
    assert.equal(body.data.summary, '정규화된 요약');
    assert.deepEqual(calls, [{
        method: 'generateSummary',
        content: '본문 내용',
        maxLength: 160,
        techTags: ['Node.js']
    }]);
    assert.deepEqual(requiredPermissions, ['blog.create', 'blog.create']);
});

test('admin AI summarize rejects invalid includeKeywords values', async () => {
    let called = false;
    const { router } = loadAiRoute({
        generateSummary: async () => {
            called = true;
        },
        generateSummaryAndKeywords: async () => {
            called = true;
        },
        extractKeywords: async () => []
    });

    const { status, body } = await requestJson(router, '/ai/summarize', {
        method: 'POST',
        body: {
            content: '본문 내용',
            includeKeywords: 'maybe'
        }
    });

    assert.equal(status, 400);
    assert.equal(body.message, 'includeKeywords는 boolean 값이어야 합니다.');
    assert.equal(called, false);
});

test('admin AI validation errors are not logged as server errors', async () => {
    const logs = [];
    const logger = {
        error: (...args) => logs.push(['error', args]),
        warn: (...args) => logs.push(['warn', args])
    };
    const { router } = loadAiRoute({
        generateSummary: async () => '요약',
        generateSummaryAndKeywords: async () => ({ summary: '요약', keywords: [], keywordsString: '' }),
        extractKeywords: async () => []
    }, logger);

    const { status, body } = await requestJson(router, '/ai/summarize', {
        method: 'POST',
        body: {
            content: '본문 내용',
            includeKeywords: 'maybe'
        }
    });

    assert.equal(status, 400);
    assert.equal(body.message, 'includeKeywords는 boolean 값이어야 합니다.');
    assert.deepEqual(logs, []);
});

test('admin AI summarize rejects missing object bodies', async () => {
    let called = false;
    const { router } = loadAiRoute({
        generateSummary: async () => {
            called = true;
        },
        generateSummaryAndKeywords: async () => {
            called = true;
        },
        extractKeywords: async () => []
    });

    const { status, body } = await requestJson(router, '/ai/summarize', {
        method: 'POST',
        body: 'plain text'
    });

    assert.equal(status, 400);
    assert.equal(body.message, 'content는 문자열이어야 합니다.');
    assert.equal(called, false);
});

test('admin AI keywords rejects out-of-range maxKeywords before service call', async () => {
    let called = false;
    const { router } = loadAiRoute({
        generateSummary: async () => '',
        generateSummaryAndKeywords: async () => ({ summary: '', keywords: [], keywordsString: '' }),
        extractKeywords: async () => {
            called = true;
        }
    });

    const { status, body } = await requestJson(router, '/ai/keywords', {
        method: 'POST',
        body: {
            content: '키워드 본문',
            maxKeywords: '0'
        }
    });

    assert.equal(status, 400);
    assert.match(body.message, /maxKeywords/);
    assert.equal(called, false);
});

test('admin AI keywords rejects partially numeric maxKeywords before service call', async () => {
    let called = false;
    const { router } = loadAiRoute({
        generateSummary: async () => '',
        generateSummaryAndKeywords: async () => ({ summary: '', keywords: [], keywordsString: '' }),
        extractKeywords: async () => {
            called = true;
        }
    });

    const { status, body } = await requestJson(router, '/ai/keywords', {
        method: 'POST',
        body: {
            content: '키워드 본문',
            maxKeywords: '3abc'
        }
    });

    assert.equal(status, 400);
    assert.match(body.message, /maxKeywords/);
    assert.equal(called, false);
});
