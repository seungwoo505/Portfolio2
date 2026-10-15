const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const { Readable } = require('node:stream');
const {
    clearRootModules,
    resolveFromRoot
} = require('./helpers/module-loader');

const {
    isSafeUploadedImageFilename,
    validateImageFile
} = require('../utils/upload');

const uploadModulePaths = [
    ['utils', 'upload.ts'],
    ['utils', 'upload', 'index.ts'],
    ['utils', 'upload', 'paths.ts'],
    ['utils', 'upload', 'storage.ts'],
    ['utils', 'upload', 'validation.ts']
];

test('같은 시각에 같은 이름으로 업로드한 파일은 서로 덮어쓰지 않고 삭제 가능한 이름을 갖는다', async t => {
    const { storage } = require('../utils/upload');
    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'portfolio-upload-collision-'));
    t.after(async () => {
        for (const filename of await fs.readdir(tempDir)) await fs.unlink(path.join(tempDir, filename));
        await fs.rmdir(tempDir);
    });
    t.mock.method(Date, 'now', () => 1800000000000);
    t.mock.method(storage, 'getDestination', (_req, _file, cb) => cb(null, tempDir));
    const contents = ['image-a', 'image-b'];
    const results = await Promise.all(contents.map(content => new Promise((resolve, reject) => {
        storage._handleFile({}, {
            originalname: 'photo.png', mimetype: 'image/png', stream: Readable.from([content])
        }, (error, result) => error ? reject(error) : resolve(result));
    })));

    assert.notEqual(results[0].filename, results[1].filename);
    for (let index = 0; index < results.length; index += 1) {
        assert.equal(isSafeUploadedImageFilename(results[index].filename), true);
        assert.equal(await fs.readFile(results[index].path, 'utf8'), contents[index]);
    }
});

test('validateImageFile accepts matching image MIME and extension', () => {
    assert.deepEqual(
        validateImageFile({ originalname: 'profile.jpeg', mimetype: 'image/jpeg' }),
        { extensions: ['.jpg', '.jpeg'], extension: '.jpg' }
    );
});

test('validateImageFile rejects MIME and extension mismatches', () => {
    assert.throws(
        () => validateImageFile({ originalname: 'profile.png', mimetype: 'image/jpeg' }),
        /MIME 타입과 파일 확장자/
    );
});

test('validateImageFile rejects unsupported image types', () => {
    assert.throws(
        () => validateImageFile({ originalname: 'vector.svg', mimetype: 'image/svg+xml' }),
        /지원되지 않는 이미지 형식/
    );
});

test('isSafeUploadedImageFilename only allows generated image basenames', () => {
    assert.equal(isSafeUploadedImageFilename('1712345678901-profile.jpg'), true);
    assert.equal(isSafeUploadedImageFilename('../1712345678901-profile.jpg'), false);
    assert.equal(isSafeUploadedImageFilename('1712345678901-profile.svg'), false);
});

test('upload max file size falls back for invalid environment values', () => {
    const previousValue = process.env.UPLOAD_MAX_FILE_SIZE;
    process.env.UPLOAD_MAX_FILE_SIZE = 'not-a-size';

    try {
        clearRootModules(uploadModulePaths);
        const { uploadMaxFileSize } = require(resolveFromRoot(['utils', 'upload.ts']));

        assert.equal(uploadMaxFileSize, 5 * 1024 * 1024);
    } finally {
        if (previousValue === undefined) {
            delete process.env.UPLOAD_MAX_FILE_SIZE;
        } else {
            process.env.UPLOAD_MAX_FILE_SIZE = previousValue;
        }
        clearRootModules(uploadModulePaths);
    }
});
