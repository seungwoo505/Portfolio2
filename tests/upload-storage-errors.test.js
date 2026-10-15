const test = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const fs = require('node:fs');
const path = require('node:path');
const { Writable } = require('node:stream');
const { startRouterServer, readJsonResponse } = require('./helpers/http-route-server');
const { clearRootModules, createNoopLogger, stubRootModule } = require('./helpers/module-loader');

const modulePaths = [
    ['utils', 'upload', 'storage.ts'],
    ['utils', 'upload', 'paths.ts'],
    ['middleware', 'request-timeout.ts'],
    ['log.ts']
];

const loadUploadMiddleware = t => {
    const previousTimeout = process.env.REQUEST_TIMEOUT;
    const previousMaxFileSize = process.env.UPLOAD_MAX_FILE_SIZE;
    process.env.REQUEST_TIMEOUT = '300';
    process.env.UPLOAD_MAX_FILE_SIZE = String(1024 * 1024);
    clearRootModules(modulePaths);
    stubRootModule(['log.ts'], createNoopLogger());
    t.after(() => clearRootModules(modulePaths));
    try {
        return {
            ...require('../utils/upload/storage.ts'),
            ...require('../utils/upload/paths.ts'),
            ...require('../middleware/request-timeout.ts')
        };
    } finally {
        if (previousTimeout === undefined) delete process.env.REQUEST_TIMEOUT;
        else process.env.REQUEST_TIMEOUT = previousTimeout;
        if (previousMaxFileSize === undefined) delete process.env.UPLOAD_MAX_FILE_SIZE;
        else process.env.UPLOAD_MAX_FILE_SIZE = previousMaxFileSize;
    }
};

const useMemoryUploadFiles = (t, uploadImageDir, { mkdirError, writeError } = {}) => {
    const originalExistsSync = fs.existsSync;
    const originalMkdirSync = fs.mkdirSync;
    const originalCreateWriteStream = fs.createWriteStream;
    const originalUnlink = fs.unlink;
    const isUploadFile = filename => path.dirname(String(filename)) === uploadImageDir;

    t.mock.method(fs, 'existsSync', filename => filename === uploadImageDir
        ? !mkdirError
        : originalExistsSync(filename));
    t.mock.method(fs, 'mkdirSync', (filename, options) => {
        if (filename !== uploadImageDir) return originalMkdirSync(filename, options);
        if (mkdirError) throw Object.assign(new Error(`${mkdirError}: mkdir '${filename}'`), { code: mkdirError });
    });
    t.mock.method(fs, 'createWriteStream', filename => {
        if (!isUploadFile(filename)) return originalCreateWriteStream(filename);
        const stream = new Writable({
            write(chunk, _encoding, callback) {
                if (writeError) {
                    return callback(Object.assign(new Error(`${writeError}: write '${filename}'`), { code: writeError }));
                }
                stream.bytesWritten += chunk.length;
                callback();
            }
        });
        stream.bytesWritten = 0;
        return stream;
    });
    t.mock.method(fs, 'unlink', (filename, callback) => {
        if (isUploadFile(filename)) return callback(null);
        return originalUnlink(filename, callback);
    });
};

const postImage = async (middleware, {
    field = 'image', filename = 'profile.png', mimetype = 'image/png', size = 16,
    includeBoundary = true, closeForm = true, multipartType = 'multipart/form-data'
} = {}) => {
    const router = express.Router();
    router.use(middleware.requestTimeoutMiddleware);
    router.post('/upload', middleware.uploadImage, (_req, res) => res.json({ success: true }));
    const server = await startRouterServer(router);
    const boundary = 'portfolio-upload-error-boundary';
    const body = Buffer.concat([
        Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="${field}"; filename="${filename}"\r\nContent-Type: ${mimetype}\r\n\r\n`),
        Buffer.alloc(size, 1),
        Buffer.from(closeForm ? `\r\n--${boundary}--\r\n` : '')
    ]);

    try {
        const response = await fetch(`${server.baseUrl}/upload`, {
            method: 'POST',
            headers: { 'Content-Type': includeBoundary ? `${multipartType}; boundary=${boundary}` : multipartType },
            body,
            signal: AbortSignal.timeout(5000)
        });
        return await readJsonResponse(response);
    } finally {
        await server.close();
    }
};

test('업로드 디렉터리 생성 오류는 타임아웃 대신 500 응답을 반환하고 내부 경로를 숨긴다', async t => {
    const middleware = loadUploadMiddleware(t);
    useMemoryUploadFiles(t, middleware.uploadImageDir, { mkdirError: 'EACCES' });

    const result = await postImage(middleware);

    assert.equal(result.status, 500);
    assert.deepEqual(result.body, { success: false, message: '이미지 업로드에 실패했습니다.' });
    assert.equal(JSON.stringify(result.body).includes(middleware.uploadImageDir), false);
});

test('이미지 파일 쓰기 공간 부족은 500 응답을 반환하고 내부 경로를 숨긴다', async t => {
    const middleware = loadUploadMiddleware(t);
    useMemoryUploadFiles(t, middleware.uploadImageDir, { writeError: 'ENOSPC' });

    const result = await postImage(middleware);

    assert.equal(result.status, 500);
    assert.deepEqual(result.body, { success: false, message: '이미지 업로드에 실패했습니다.' });
    assert.equal(JSON.stringify(result.body).includes(middleware.uploadImageDir), false);
});

for (const mkdirError of [undefined, 'EACCES', 'ENOSPC']) {
    test(`업로드 디렉터리 ${mkdirError || '정상'} 처리 결과를 콜백으로 정확히 한 번 전달한다`, t => {
        const middleware = loadUploadMiddleware(t);
        useMemoryUploadFiles(t, middleware.uploadImageDir, { mkdirError });
        const results = [];

        assert.doesNotThrow(() => {
            middleware.storage.getDestination({}, {}, (error, destination) => results.push({ error, destination }));
        });

        assert.equal(results.length, 1);
        if (mkdirError) {
            assert.equal(results[0].error.code, mkdirError);
            assert.equal(results[0].destination, undefined);
        } else {
            assert.equal(results[0].error, null);
            assert.equal(results[0].destination, middleware.uploadImageDir);
        }
    });
}

for (const { name, options, status, message } of [
    {
        name: 'MIME와 확장자 불일치', options: { filename: 'profile.jpg' }, status: 400,
        message: '이미지 MIME 타입과 파일 확장자가 일치하지 않습니다.'
    },
    {
        name: '지원되지 않는 파일 형식', options: { filename: 'profile.svg', mimetype: 'image/svg+xml' }, status: 400,
        message: '지원되지 않는 이미지 형식입니다.'
    },
    { name: '예상하지 않은 파일 필드', options: { field: 'other' }, status: 400, message: 'Unexpected field' },
    {
        name: '파일 크기 초과', options: { size: 1024 * 1024 + 1 }, status: 413,
        message: '이미지 파일 크기는 1MB를 초과할 수 없습니다.'
    }
]) {
    test(`이미지 업로드 ${name}의 기존 클라이언트 오류 응답을 보존한다`, async t => {
        const middleware = loadUploadMiddleware(t);
        useMemoryUploadFiles(t, middleware.uploadImageDir);

        const result = await postImage(middleware, options);

        assert.equal(result.status, status);
        assert.deepEqual(result.body, { success: false, message });
    });
}

for (const { name, options } of [
    { name: 'multipart 경계가 없는', options: { includeBoundary: false } },
    { name: 'multipart 폼이 잘린', options: { closeForm: false } }
]) {
    test(`${name} 업로드 요청은 클라이언트 오류 400으로 반환한다`, async t => {
        const middleware = loadUploadMiddleware(t);
        useMemoryUploadFiles(t, middleware.uploadImageDir);

        const result = await postImage(middleware, options);

        assert.equal(result.status, 400);
        assert.equal(result.body.success, false);
        assert.equal(JSON.stringify(result.body).includes(middleware.uploadImageDir), false);
    });
}

for (const multipartType of ['multipart/mixed', 'multipart/related']) {
    test(`지원하지 않는 ${multipartType} 업로드 요청은 클라이언트 오류 400으로 반환한다`, async t => {
        const middleware = loadUploadMiddleware(t);
        useMemoryUploadFiles(t, middleware.uploadImageDir);

        const result = await postImage(middleware, { multipartType });

        assert.equal(result.status, 400);
        assert.deepEqual(result.body, { success: false, message: '이미지 업로드 요청이 올바르지 않습니다.' });
    });
}
