const test = require('node:test');
const assert = require('node:assert/strict');
const { createModelFixture } = require('./helpers/content-model-fixture');

test('Experiences.update can explicitly clear nullable fields', async () => {
    const fixture = createModelFixture(['models', 'experiences.js']);

    await fixture.model.update(7, {
        location: null,
        description: '',
        end_date: null,
        is_current: false
    });

    const updateExperience = fixture.operations.find((operation) => operation.sql.startsWith('pool:update experiences'));
    assert.ok(updateExperience);
    assert.equal(updateExperience.sql.includes('coalesce'), false);
    assert.equal(updateExperience.sql.includes('location = ?'), true);
    assert.equal(updateExperience.sql.includes('description = ?'), true);
    assert.equal(updateExperience.sql.includes('end_date = ?'), true);
    assert.equal(updateExperience.sql.includes('is_current = ?'), true);
    assert.deepEqual(updateExperience.params, [null, null, null, false, 7]);
});
