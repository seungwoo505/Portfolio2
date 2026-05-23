const test = require('node:test');
const assert = require('node:assert/strict');

const { parsePagination } = require('../utils/pagination');

test('parsePagination clamps invalid and out-of-range values', () => {
    assert.deepEqual(parsePagination({ limit: '-1', page: '0' }), {
        limit: 1,
        page: 1,
        offset: 0
    });

    assert.deepEqual(parsePagination({ limit: '500', page: '10001' }, { maxLimit: 100, maxPage: 10000 }), {
        limit: 100,
        page: 10000,
        offset: 999900
    });
});

test('parsePagination supports array query values and fallback defaults', () => {
    assert.deepEqual(parsePagination({ limit: ['30'], page: ['3'] }), {
        limit: 30,
        page: 3,
        offset: 60
    });

    assert.deepEqual(parsePagination({ limit: 'abc', page: 'xyz' }, { defaultLimit: 25 }), {
        limit: 25,
        page: 1,
        offset: 0
    });
});
