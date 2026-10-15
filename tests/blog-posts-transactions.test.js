const test = require('node:test');
const assert = require('node:assert/strict');
const { createModelFixture, hasOperation } = require('./helpers/content-model-fixture');

test('필수 항목만으로 글을 생성할 때 DB에 undefined를 전달하지 않는다', async () => {
    const fixture = createModelFixture(['models', 'blog-posts.ts']);
    const postId = await fixture.model._create({ title: '제목', content: '본문' });
    const insert = fixture.operations.find(operation => operation.sql.startsWith('insert into blog_posts'));

    assert.equal(postId, 101);
    assert.equal(insert.params.includes(undefined), false);
    assert.deepEqual(insert.params.slice(3, 11), [null, '본문', null, null, null, null, false, false]);
    assert.deepEqual(insert.params.slice(12), [null, null, null, null]);
});

test('공개 글을 다시 저장하는 SQL은 기존 발행일을 보존한다', async () => {
    const fixture = createModelFixture(['models', 'blog-posts.ts']);
    await fixture.model._update(10, { content: '수정 본문', is_published: true });
    const update = fixture.operations.find(operation => operation.sql.startsWith('update blog_posts set'));

    assert.match(update.sql, /published_at = coalesce\(published_at, now\(\)\)/);
    assert.doesNotMatch(update.sql, /published_at = now\(\)/);
});

test('비공개 전환 시 발행일을 비우고 일반 수정은 발행일을 건드리지 않는다', async () => {
    const fixture = createModelFixture(['models', 'blog-posts.ts']);
    await fixture.model._update(10, { is_published: false });
    await fixture.model._update(10, { content: '본문만 수정' });
    const updates = fixture.operations.filter(operation => operation.sql.startsWith('update blog_posts set'));

    assert.match(updates[0].sql, /published_at = null/);
    assert.doesNotMatch(updates[1].sql, /published_at/);
});

test('BlogPosts._create writes the post and tags inside one transaction connection', async () => {
    const fixture = createModelFixture(['models', 'blog-posts.ts']);

    const postId = await fixture.model._create({
        title: '테스트 글',
        content: 'Node.js transaction test content',
        is_published: true,
        tags: ['Node.js', 'Backend']
    });

    assert.equal(postId, 101);
    assert.equal(fixture.transactionCount, 1);
    assert.equal(hasOperation(fixture.operations, 'insert into blog_posts'), true);
    assert.equal(hasOperation(fixture.operations, "delete from tag_usage where content_type = 'blog_post'"), true);
    assert.equal(hasOperation(fixture.operations, 'insert into tags'), true);
    assert.equal(hasOperation(fixture.operations, "insert ignore into tag_usage"), true);
    assert.equal(fixture.operations.some((operation) => operation.sql.startsWith('pool:')), false);
});

test('BlogPosts._delete removes post tag usage and recalculates tag counts in one transaction', async () => {
    const fixture = createModelFixture(['models', 'blog-posts.ts']);

    await fixture.model._delete(10);

    assert.equal(fixture.transactionCount, 1);
    assert.equal(hasOperation(fixture.operations, "delete from tag_usage where content_type = 'blog_post'"), true);
    assert.equal(hasOperation(fixture.operations, 'delete from blog_posts where id = ?'), true);
    assert.equal(hasOperation(fixture.operations, 'update tags t left join'), true);
});

test('BlogPosts._update can explicitly clear nullable fields and tags', async () => {
    const fixture = createModelFixture(['models', 'blog-posts.ts']);

    await fixture.model._update(10, {
        featured_image: null,
        meta_description: null,
        tags: []
    });

    const updateQuery = fixture.operations.find((operation) => operation.sql.startsWith('update blog_posts set'));
    assert.ok(updateQuery);
    assert.equal(updateQuery.sql.includes('featured_image = ?'), true);
    assert.equal(updateQuery.sql.includes('meta_description = ?'), true);
    assert.deepEqual(updateQuery.params, [null, null, 10]);
    assert.equal(hasOperation(fixture.operations, "delete from tag_usage where content_type = 'blog_post'"), true);
});

test('BlogPosts.getWithFilters normalizes array query values', async () => {
    const fixture = createModelFixture(['models', 'blog-posts.ts']);

    await fixture.model.getWithFilters({
        order: ['asc', 'desc'],
        sort: ['title'],
        search: ['node'],
        tags: 'backend',
        featured: ['true']
    });

    const listQuery = fixture.operations.find((operation) => operation.sql.startsWith('pool:select bp.*'));
    assert.ok(listQuery);
    assert.equal(listQuery.sql.includes('order by bp.is_featured desc, bp.title asc'), true);
    assert.deepEqual(listQuery.params, [1, 'backend', '%node%', '%node%', '%node%', '%node%', 10, 0]);
});
