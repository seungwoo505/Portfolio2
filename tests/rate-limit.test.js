const test = require('node:test');
const assert = require('node:assert/strict');

const { getRetryAfterSeconds } = require('../utils/rate-limit');

test('getRetryAfterSeconds returns remaining seconds for Date resetTime', () => {
    const now = Date.UTC(2026, 0, 1, 0, 0, 0);
    const resetTime = new Date(now + 42_500);

    assert.equal(getRetryAfterSeconds({ resetTime }, 60, now), 43);
});

test('getRetryAfterSeconds accepts epoch milliseconds and seconds', () => {
    const now = Date.UTC(2026, 0, 1, 0, 0, 0);

    assert.equal(getRetryAfterSeconds({ resetTime: now + 10_000 }, 60, now), 10);
    assert.equal(getRetryAfterSeconds({ resetTime: (now + 20_000) / 1000 }, 60, now), 20);
});

test('getRetryAfterSeconds clamps expired or missing resetTime to a positive fallback', () => {
    const now = Date.UTC(2026, 0, 1, 0, 0, 0);

    assert.equal(getRetryAfterSeconds({ resetTime: new Date(now - 1000) }, 60, now), 1);
    assert.equal(getRetryAfterSeconds({}, 900, now), 900);
    assert.equal(getRetryAfterSeconds({}, 0, now), 1);
});
