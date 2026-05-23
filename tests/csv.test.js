const test = require('node:test');
const assert = require('node:assert/strict');

const { escapeCsvField } = require('../utils/csv');

test('escapeCsvField quotes fields and escapes quotes', () => {
    assert.equal(escapeCsvField('a,b'), '"a,b"');
    assert.equal(escapeCsvField('a"b'), '"a""b"');
    assert.equal(escapeCsvField('line\nbreak'), '"line\nbreak"');
});

test('escapeCsvField prefixes spreadsheet formula values', () => {
    assert.equal(escapeCsvField('=cmd|calc'), '"\'=cmd|calc"');
    assert.equal(escapeCsvField(' +SUM(A1:A2)'), '"\' +SUM(A1:A2)"');
    assert.equal(escapeCsvField('@user'), '"\'@user"');
});

test('escapeCsvField serializes empty values as empty quoted fields', () => {
    assert.equal(escapeCsvField(null), '""');
    assert.equal(escapeCsvField(undefined), '""');
});
