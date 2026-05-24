const test = require('node:test');
const assert = require('node:assert/strict');

const {
    buildErrorResponse,
    getStatusCode,
    isJsonParseError
} = require('../utils/error-response');

test('buildErrorResponse hides unexpected server error messages in production', () => {
    const error = new Error('database password leaked');
    const response = buildErrorResponse(error, { nodeEnv: 'production' });

    assert.equal(response.statusCode, 500);
    assert.equal(response.isClientError, false);
    assert.deepEqual(response.body, {
        success: false,
        message: '서버 내부 오류가 발생했습니다.'
    });
});

test('buildErrorResponse includes server error details in development', () => {
    const error = new Error('development failure');
    const response = buildErrorResponse(error, { nodeEnv: 'development' });

    assert.equal(response.statusCode, 500);
    assert.equal(response.body.message, 'development failure');
    assert.match(response.body.stack, /development failure/);
});

test('buildErrorResponse maps JSON parser errors to a stable client message', () => {
    const error = new SyntaxError('Unexpected token } in JSON');
    error.status = 400;
    error.type = 'entity.parse.failed';
    error.body = '{bad json}';

    const response = buildErrorResponse(error, { nodeEnv: 'production' });

    assert.equal(isJsonParseError(error), true);
    assert.equal(response.statusCode, 400);
    assert.equal(response.isClientError, true);
    assert.equal(response.body.message, '요청 JSON 형식이 올바르지 않습니다.');
});

test('buildErrorResponse preserves explicit client error messages', () => {
    const error = new Error('이미지 파일 크기가 너무 큽니다.');
    error.statusCode = 413;

    const response = buildErrorResponse(error, { nodeEnv: 'production' });

    assert.equal(getStatusCode(error), 413);
    assert.equal(response.statusCode, 413);
    assert.equal(response.isClientError, true);
    assert.equal(response.body.message, '이미지 파일 크기가 너무 큽니다.');
});
