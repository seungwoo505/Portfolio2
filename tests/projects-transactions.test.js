const test = require('node:test');
const assert = require('node:assert/strict');
const { createModelFixture, hasOperation } = require('./helpers/content-model-fixture');

test('Projects.create writes the project and tags inside one transaction connection', async () => {
    const fixture = createModelFixture(['models', 'projects.js']);

    const projectId = await fixture.model.create({
        title: 'Portfolio API',
        description: '관리자 API',
        content: 'Project content',
        tags: ['Node.js', 'MySQL']
    });

    assert.equal(projectId, 201);
    assert.equal(fixture.transactionCount, 1);
    assert.equal(hasOperation(fixture.operations, 'insert into projects'), true);
    assert.equal(hasOperation(fixture.operations, "delete from tag_usage where content_type = 'project'"), true);
    assert.equal(hasOperation(fixture.operations, 'insert into tags'), true);
    assert.equal(hasOperation(fixture.operations, "insert ignore into tag_usage"), true);
    assert.equal(fixture.operations.some((operation) => operation.sql.startsWith('pool:')), false);
});

test('Projects.create stores block content fields', async () => {
    const fixture = createModelFixture(['models', 'projects.js']);

    await fixture.model.create({
        title: 'Block Project',
        description: '블록 프로젝트',
        content: '# Legacy',
        content_json: [{ type: 'paragraph', content: '블록 내용' }],
        content_html: '<p>블록 내용</p>',
        content_text: '블록 내용'
    });

    const insertQuery = fixture.operations.find((operation) => operation.sql.includes('insert into projects'));
    assert.ok(insertQuery);
    assert.equal(insertQuery.sql.includes('content_json'), true);
    assert.equal(insertQuery.sql.includes('content_html'), true);
    assert.equal(insertQuery.sql.includes('content_text'), true);
    assert.equal(insertQuery.params[5], JSON.stringify([{ type: 'paragraph', content: '블록 내용' }]));
    assert.equal(insertQuery.params[6], '<p>블록 내용</p>');
    assert.equal(insertQuery.params[7], '블록 내용');
});

test('Projects.getAll binds pagination values instead of interpolating them', async () => {
    const fixture = createModelFixture(['models', 'projects.js']);

    await fixture.model.getAll(25, 50);

    const listQuery = fixture.operations.find((operation) => operation.sql.startsWith('pool:select p.*'));
    assert.ok(listQuery);
    assert.equal(listQuery.sql.includes('limit ? offset ?'), true);
    assert.deepEqual(listQuery.params, [25, 50]);
});

test('Projects.getFeatured binds pagination values', async () => {
    const fixture = createModelFixture(['models', 'projects.js']);

    await fixture.model.getFeatured(12, 24);

    const listQuery = fixture.operations.find((operation) => operation.sql.startsWith('pool:select p.*'));
    assert.ok(listQuery);
    assert.equal(listQuery.sql.includes('where p.is_featured = 1 and p.is_published = 1'), true);
    assert.equal(listQuery.sql.includes('limit ? offset ?'), true);
    assert.deepEqual(listQuery.params, [12, 24]);
});

test('Projects.getWithFilters normalizes array query values', async () => {
    const fixture = createModelFixture(['models', 'projects.js']);

    await fixture.model.getWithFilters({
        order: ['desc', 'asc'],
        sort: ['title'],
        search: ['portfolio'],
        tags: 'backend',
        skills: ['Node.js'],
        featured: ['false']
    });

    const listQuery = fixture.operations.find((operation) => operation.sql.startsWith('pool:select p.*'));
    assert.ok(listQuery);
    assert.equal(listQuery.sql.includes('order by p.is_featured desc, p.title desc'), true);
    assert.deepEqual(listQuery.params, [0, 'backend', 'Node.js', '%portfolio%', '%portfolio%', '%portfolio%', '%portfolio%', '%portfolio%', 10, 0]);
});

test('Projects.update can explicitly clear demo_url through project_url', async () => {
    const fixture = createModelFixture(['models', 'projects.js']);

    await fixture.model.update(20, { project_url: '' });

    const updateQuery = fixture.operations.find((operation) => operation.sql.startsWith('update projects set'));
    assert.ok(updateQuery);
    assert.equal(updateQuery.sql.includes('demo_url = ?'), true);
    assert.deepEqual(updateQuery.params, [null, 20]);
});

test('Projects.update can store block content fields', async () => {
    const fixture = createModelFixture(['models', 'projects.js']);

    await fixture.model.update(20, {
        content_json: [{ type: 'paragraph', content: '수정 내용' }],
        content_html: '<p>수정 내용</p>',
        content_text: '수정 내용'
    });

    const updateQuery = fixture.operations.find((operation) => operation.sql.startsWith('update projects set'));
    assert.ok(updateQuery);
    assert.equal(updateQuery.sql.includes('content_json = ?'), true);
    assert.equal(updateQuery.sql.includes('content_html = ?'), true);
    assert.equal(updateQuery.sql.includes('content_text = ?'), true);
    assert.deepEqual(updateQuery.params, [
        JSON.stringify([{ type: 'paragraph', content: '수정 내용' }]),
        '<p>수정 내용</p>',
        '수정 내용',
        20
    ]);
});

test('Projects.update normalizes string tags and can clear all tags', async () => {
    const fixture = createModelFixture(['models', 'projects.js']);

    await fixture.model.update(20, { tags: 'backend, node' });

    assert.equal(hasOperation(fixture.operations, "delete from tag_usage where content_type = 'project'"), true);
    const tagSelects = fixture.operations.filter((operation) => operation.sql.includes('select id from tags where name = ?'));
    assert.deepEqual(tagSelects.map((operation) => operation.params), [['backend'], ['node']]);

    fixture.operations.length = 0;
    await fixture.model.update(20, { tags: null });

    assert.equal(hasOperation(fixture.operations, "delete from tag_usage where content_type = 'project'"), true);
    assert.equal(hasOperation(fixture.operations, 'insert ignore into tag_usage'), false);
});

test('Projects.delete removes child rows and recalculates tag counts in one transaction', async () => {
    const fixture = createModelFixture(['models', 'projects.js']);

    await fixture.model.delete(20);

    assert.equal(fixture.transactionCount, 1);
    assert.equal(hasOperation(fixture.operations, 'delete from project_skills where project_id = ?'), true);
    assert.equal(hasOperation(fixture.operations, 'delete from project_images where project_id = ?'), true);
    assert.equal(hasOperation(fixture.operations, "delete from tag_usage where content_type = 'project'"), true);
    assert.equal(hasOperation(fixture.operations, 'delete from projects where id = ?'), true);
    assert.equal(hasOperation(fixture.operations, 'update tags t left join'), true);
});
