const test = require('node:test');
const assert = require('node:assert/strict');

const { generateSlug, isValidSlug } = require('../utils/slug');

test('generateSlug normalizes text into URL-safe slugs', () => {
    assert.equal(generateSlug('Hello Portfolio!'), 'hello-portfolio');
    assert.equal(generateSlug('  한글 제목  '), '한글-제목');
    assert.equal(generateSlug('***', 'fallback'), 'fallback');
});

test('isValidSlug accepts generated slug shapes', () => {
    assert.equal(isValidSlug('project-a'), true);
    assert.equal(isValidSlug('post-2026'), true);
    assert.equal(isValidSlug('한글-제목'), true);
});

test('isValidSlug rejects malformed slug params', () => {
    assert.equal(isValidSlug(''), false);
    assert.equal(isValidSlug('-project'), false);
    assert.equal(isValidSlug('project-'), false);
    assert.equal(isValidSlug('project--a'), false);
    assert.equal(isValidSlug('Project-A'), false);
    assert.equal(isValidSlug('project.a'), false);
    assert.equal(isValidSlug('project/a'), false);
    assert.equal(isValidSlug('a'.repeat(256)), false);
});
