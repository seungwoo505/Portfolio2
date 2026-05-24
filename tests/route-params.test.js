const test = require('node:test');
const assert = require('node:assert/strict');

const { parsePositiveIntegerParam } = require('../utils/route-params');

test('parsePositiveIntegerParam accepts positive integer params', () => {
    assert.equal(parsePositiveIntegerParam('1'), 1);
    assert.equal(parsePositiveIntegerParam(' 42 '), 42);
    assert.equal(parsePositiveIntegerParam(7), 7);
    assert.equal(parsePositiveIntegerParam(['9']), 9);
});

test('parsePositiveIntegerParam rejects invalid params', () => {
    assert.equal(parsePositiveIntegerParam(''), null);
    assert.equal(parsePositiveIntegerParam('0'), null);
    assert.equal(parsePositiveIntegerParam('-1'), null);
    assert.equal(parsePositiveIntegerParam('1.5'), null);
    assert.equal(parsePositiveIntegerParam('12abc'), null);
    assert.equal(parsePositiveIntegerParam('9007199254740992'), null);
    assert.equal(parsePositiveIntegerParam({ id: 1 }), null);
});
