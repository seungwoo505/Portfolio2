const test = require('node:test');
const assert = require('node:assert/strict');

const {
    toBooleanOrNull,
    toChoice,
    toStringArray,
    toStringValue
} = require('../utils/filter-values');

test('filter value helpers normalize array query values', () => {
    assert.equal(toStringValue(['desc', 'asc']), 'desc');
    assert.deepEqual(toStringArray(['node', ['mysql'], '', null]), ['node', 'mysql']);
});

test('filter value helpers normalize booleans and choices', () => {
    assert.equal(toBooleanOrNull(['true']), true);
    assert.equal(toBooleanOrNull('0'), false);
    assert.equal(toBooleanOrNull({ value: true }), null);
    assert.equal(toChoice(['ASC'], ['asc', 'desc'], 'desc'), 'asc');
    assert.equal(toChoice({}, ['asc', 'desc'], 'desc'), 'desc');
});
