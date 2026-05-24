const test = require('node:test');
const assert = require('node:assert/strict');
const {
    clearRootModules,
    resolveFromRoot
} = require('./helpers/module-loader');

const {
    isSafeUploadedImageFilename,
    validateImageFile
} = require('../utils/upload');

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
        clearRootModules([['utils', 'upload.js']]);
        const { uploadMaxFileSize } = require(resolveFromRoot(['utils', 'upload.js']));

        assert.equal(uploadMaxFileSize, 5 * 1024 * 1024);
    } finally {
        if (previousValue === undefined) {
            delete process.env.UPLOAD_MAX_FILE_SIZE;
        } else {
            process.env.UPLOAD_MAX_FILE_SIZE = previousValue;
        }
        clearRootModules([['utils', 'upload.js']]);
    }
});
