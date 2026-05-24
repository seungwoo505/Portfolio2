const test = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');

const {
    clearRootModules,
    createNoopLogger,
    resolveFromRoot,
    stubRootModule
} = require('./helpers/module-loader');

const requestJson = async (router, pathName, { method = 'GET' } = {}) => {
    const app = express();
    app.use(router);

    const server = await new Promise((resolve) => {
        const activeServer = app.listen(0, '127.0.0.1', () => resolve(activeServer));
    });

    try {
        const { port } = server.address();
        const response = await fetch(`http://127.0.0.1:${port}${pathName}`, { method });
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

const loadUploadsRoute = (filePath) => {
    clearRootModules([
        ['routes', 'admin', 'uploads.js'],
        ['routes', 'admin', 'common.js'],
        ['utils', 'upload.js'],
        ['middleware', 'auth.js'],
        ['log.js']
    ]);

    stubRootModule(['routes', 'admin', 'common.js'], {
        logger: createNoopLogger(),
        verboseDebug: () => {},
        buildErrorLog: (error) => ({ error: error.message })
    });
    stubRootModule(['utils', 'upload.js'], {
        uploadImage: (_req, _res, next) => next(),
        getUploadedImagePath: () => filePath,
        isSafeUploadedImageFilename: () => true
    });
    stubRootModule(['middleware', 'auth.js'], {
        authenticateToken: (req, _res, next) => {
            req.admin = { id: 1, role: 'super_admin' };
            next();
        },
        requirePermission: () => (_req, _res, next) => next(),
        logActivity: () => (_req, _res, next) => next()
    });

    return require(resolveFromRoot(['routes', 'admin', 'uploads.js']));
};

test('admin upload delete removes an existing image asynchronously', async () => {
    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'portfolio-upload-route-'));
    const filePath = path.join(tempDir, '123-test.png');
    await fs.writeFile(filePath, 'image');

    const router = loadUploadsRoute(filePath);
    const { status, body } = await requestJson(router, '/upload/image/123-test.png', {
        method: 'DELETE'
    });

    assert.equal(status, 200);
    assert.equal(body.message, '이미지가 성공적으로 삭제되었습니다.');
    await assert.rejects(fs.access(filePath), { code: 'ENOENT' });
});

test('admin upload delete maps missing image to 404', async () => {
    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'portfolio-upload-route-'));
    const filePath = path.join(tempDir, '123-missing.png');

    const router = loadUploadsRoute(filePath);
    const { status, body } = await requestJson(router, '/upload/image/123-missing.png', {
        method: 'DELETE'
    });

    assert.equal(status, 404);
    assert.equal(body.message, '삭제할 이미지를 찾을 수 없습니다.');
});
