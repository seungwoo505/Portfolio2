const test = require('node:test');
const assert = require('node:assert/strict');

const { parseIntegerEnv } = require('../utils/env-number');

test('parseIntegerEnv falls back for missing or invalid values', () => {
    assert.equal(parseIntegerEnv(undefined, { fallback: 5 }), 5);
    assert.equal(parseIntegerEnv('not-a-number', { fallback: 5 }), 5);
});

test('parseIntegerEnv clamps values to min and max', () => {
    assert.equal(parseIntegerEnv('0', { fallback: 5, min: 1, max: 100 }), 1);
    assert.equal(parseIntegerEnv('500', { fallback: 5, min: 1, max: 100 }), 100);
});

test('parseIntegerEnv uses the first array value', () => {
    assert.equal(parseIntegerEnv(['12', '99'], { fallback: 5, min: 1, max: 100 }), 12);
});
