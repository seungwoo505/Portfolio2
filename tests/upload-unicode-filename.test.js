const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { Writable } = require('node:stream');
const { startRouterServer } = require('./helpers/http-route-server');
const { clearRootModules, createNoopLogger, stubRootModule } = require('./helpers/module-loader');

const modulePaths = [
    ['routes', 'admin', 'uploads.ts'], ['routes', 'admin', 'uploads', 'images.ts'],
    ['routes', 'admin', 'common.ts'], ['middleware', 'auth.ts'], ['log.ts'],
    ['utils', 'upload.ts'], ['utils', 'upload', 'index.ts'], ['utils', 'upload', 'storage.ts']
];

const startUploads = async t => {
    clearRootModules(modulePaths);
    t.after(() => clearRootModules(modulePaths));
    const logger = createNoopLogger();
    stubRootModule(['log.ts'], logger);
    stubRootModule(['routes', 'admin', 'common.ts'], {
        logger, verboseDebug: () => {}, buildErrorLog: error => ({ error: error.message })
    });
    const pass = (_req, _res, next) => next();
    stubRootModule(['middleware', 'auth.ts'], {
        authenticateToken: pass, requirePermission: () => pass, logActivity: () => pass
    });
    const { uploadImageDir } = require('../utils/upload/paths.ts');
    const files = new Map();
    const realExistsSync = fs.existsSync;
    const realCreateWriteStream = fs.createWriteStream;
    t.mock.method(fs, 'existsSync', filename => filename === uploadImageDir || realExistsSync(filename));
    // 디스크 경계만 대체하고 Multer의 파싱·필터·저장 파일명과 관리자 응답은 실제 코드를 사용한다.
    t.mock.method(fs, 'createWriteStream', filename => {
        if (path.dirname(String(filename)) !== uploadImageDir) return realCreateWriteStream(filename);
        const chunks = [];
        files.set(path.basename(filename), chunks);
        const stream = new Writable({
            write(chunk, _encoding, callback) {
                chunks.push(Buffer.from(chunk));
                stream.bytesWritten += chunk.length;
                callback();
            }
        });
        stream.bytesWritten = 0;
        return stream;
    });
    const server = await startRouterServer(require('../routes/admin/uploads.ts'));
    t.after(server.close);
    return { ...server, files };
};

const postImage = async (server, filename, type) => {
    const form = new FormData();
    form.append('image', new Blob([Buffer.from([137, 80, 78, 71])], { type }), filename);
    const response = await fetch(server.baseUrl + '/upload/image', { method: 'POST', body: form });
    return { status: response.status, body: await response.json() };
};

// latin1으로 multipart filename을 읽으면 originalName과 저장 basename이 모두 깨진다.
for (const { filename, base } of [{ filename: '프로필.png', base: '프로필' }, { filename: 'profile.png', base: 'profile' }]) {
    test(`실제 관리자 FormData 업로드에서 ${filename} 원본명과 저장 basename을 보존한다`, async t => {
        const server = await startUploads(t);
        const result = await postImage(server, filename, 'image/png');
        assert.equal(result.status, 200);
        assert.equal(result.body.success, true);
        assert.equal(result.body.data.originalName, filename);
        assert.match(result.body.data.filename, new RegExp(`^\\d+-${base}-[a-f0-9]{32}\\.png$`));
        assert.equal(result.body.data.size, 4);
        assert.equal(result.body.data.url, `${server.baseUrl}/uploads/images/${result.body.data.filename}`);
        assert.deepEqual([...server.files.keys()], [result.body.data.filename]);
        assert.deepEqual(Buffer.concat(server.files.get(result.body.data.filename)), Buffer.from([137, 80, 78, 71]));
    });
}

for (const { filename, type, message } of [
    { filename: '프로필.jpg', type: 'image/png', message: '이미지 MIME 타입과 파일 확장자가 일치하지 않습니다.' },
    { filename: '프로필.svg', type: 'image/svg+xml', message: '지원되지 않는 이미지 형식입니다.' }
]) {
    test(`한글 FormData 업로드도 ${filename} MIME·확장자 오류를 400으로 반환한다`, async t => {
        const server = await startUploads(t);
        const result = await postImage(server, filename, type);
        assert.equal(result.status, 400);
        assert.deepEqual(result.body, { success: false, message });
        assert.equal(server.files.size, 0);
    });
}
