const test = require('node:test');
const assert = require('node:assert/strict');

const {
    apiResponseNormalizer,
    buildErrorBody,
    buildSuccessBody,
    normalizeApiResponseBody,
    sendTooManyRequests
} = require('../utils/api-response');

const createResponseStub = () => ({
    statusCode: undefined,
    body: undefined,
    status(statusCode) {
        this.statusCode = statusCode;
        return this;
    },
    json(body) {
        this.body = body;
        return this;
    }
});

test('normalizeApiResponseBody maps error-only failures to message', () => {
    assert.deepEqual(
        normalizeApiResponseBody({
            success: false,
            error: '요청이 너무 많습니다.'
        }),
        {
            success: false,
            error: '요청이 너무 많습니다.',
            message: '요청이 너무 많습니다.'
        }
    );
});

test('normalizeApiResponseBody preserves explicit messages', () => {
    assert.deepEqual(
        normalizeApiResponseBody({
            success: false,
            message: '표준 메시지',
            error: '호환 메시지'
        }),
        {
            success: false,
            message: '표준 메시지',
            error: '호환 메시지'
        }
    );
});

test('buildSuccessBody includes data, message, and metadata consistently', () => {
    assert.deepEqual(
        buildSuccessBody([1, 2], {
            message: '조회되었습니다.',
            pagination: { page: 1, limit: 10, total: 2 }
        }),
        {
            success: true,
            message: '조회되었습니다.',
            data: [1, 2],
            pagination: { page: 1, limit: 10, total: 2 }
        }
    );
});

test('buildErrorBody uses message as canonical error text', () => {
    assert.deepEqual(
        buildErrorBody('실패했습니다.', {
            error: true,
            retryAfter: 60
        }),
        {
            success: false,
            message: '실패했습니다.',
            error: '실패했습니다.',
            retryAfter: 60
        }
    );
});

test('sendTooManyRequests sends normalized JSON response', () => {
    const res = createResponseStub();

    sendTooManyRequests(res, '잠시 후 다시 시도해주세요.', {
        error: true,
        retryAfter: 30
    });

    assert.equal(res.statusCode, 429);
    assert.deepEqual(res.body, {
        success: false,
        message: '잠시 후 다시 시도해주세요.',
        error: '잠시 후 다시 시도해주세요.',
        retryAfter: 30
    });
});

test('apiResponseNormalizer wraps res.json output', () => {
    const res = {
        body: undefined,
        json(body) {
            this.body = body;
            return this;
        }
    };

    apiResponseNormalizer({}, res, () => {});
    res.json({
        success: false,
        error: '호출 제한'
    });

    assert.deepEqual(res.body, {
        success: false,
        error: '호출 제한',
        message: '호출 제한'
    });
});
