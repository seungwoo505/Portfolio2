const test = require('node:test');
const assert = require('node:assert/strict');
const { createModelFixture, hasOperation } = require('./helpers/content-model-fixture');
const {
    clearRootModules,
    resolveFromRoot,
    stubRootModule
} = require('./helpers/module-loader');

const loadProjectCommon = () => {
    clearRootModules([
        ['models', 'projects', 'common.ts'],
        ['models', 'db-utils.ts'],
        ['utils', 'slug.ts']
    ]);

    stubRootModule(['models', 'db-utils.ts'], {});
    stubRootModule(['utils', 'slug.ts'], {
        generateSlug: (value, fallback = 'item') => String(value || fallback),
        createUniqueSlug: async ({ value }) => String(value || 'project')
    });

    return require(resolveFromRoot(['models', 'projects', 'common.ts']));
};

test('Projects.create writes the project and tags inside one transaction connection', async () => {
    const fixture = createModelFixture(['models', 'projects.ts']);

    const projectId = await fixture.model.create({
        title: 'Portfolio API',
        description: '관리자 API',
        content: 'Project content',
        tags: ['Node.js', 'MySQL']
    });

    assert.equal(projectId, 201);
    assert.equal(fixture.transactionCount, 1);
    assert.equal(hasOperation(fixture.operations, 'insert into projects'), true);
    assert.equal(hasOperation(fixture.operations, 'insert into project_catalog_profiles'), true);
    assert.equal(hasOperation(fixture.operations, 'delete from project_tags where project_id = ?'), true);
    assert.equal(hasOperation(fixture.operations, 'insert into tags'), true);
    assert.equal(hasOperation(fixture.operations, 'insert ignore into project_tags'), true);
    assert.equal(fixture.operations.some((operation) => operation.sql.startsWith('pool:')), false);
});

test('Projects.create stores block content fields', async () => {
    const fixture = createModelFixture(['models', 'projects.ts']);

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
    assert.equal(insertQuery.params[4], '<p>블록 내용</p>');
    assert.equal(insertQuery.params[5], JSON.stringify([{ type: 'paragraph', content: '블록 내용' }]));
    assert.equal(insertQuery.params[6], '블록 내용');
});

test('Projects.getAll binds pagination values instead of interpolating them', async () => {
    const fixture = createModelFixture(['models', 'projects.ts']);

    await fixture.model.getAll(25, 50);

    const listQuery = fixture.operations.find((operation) => operation.sql.startsWith('pool:select p.*'));
    assert.ok(listQuery);
    assert.equal(listQuery.sql.includes('limit ? offset ?'), true);
    assert.deepEqual(listQuery.params, [25, 50]);
});

test('Projects.getFeatured binds pagination values', async () => {
    const fixture = createModelFixture(['models', 'projects.ts']);

    await fixture.model.getFeatured(12, 24);

    const listQuery = fixture.operations.find((operation) => operation.sql.startsWith('pool:select p.*'));
    assert.ok(listQuery);
    assert.equal(listQuery.sql.includes('where p.is_featured = 1 and p.is_published = 1'), true);
    assert.equal(listQuery.sql.includes('limit ? offset ?'), true);
    assert.deepEqual(listQuery.params, [12, 24]);
});

test('Projects.getWithFilters normalizes array query values', async () => {
    const fixture = createModelFixture(['models', 'projects.ts']);

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
    assert.deepEqual(listQuery.params, [
        0,
        'backend',
        'backend',
        'Node.js',
        'Node.js',
        '%portfolio%',
        '%portfolio%',
        '%portfolio%',
        '%portfolio%',
        '%portfolio%',
        '%portfolio%',
        '%portfolio%',
        '%portfolio%',
        '%portfolio%',
        '%portfolio%',
        10,
        0
    ]);
});

test('Projects.getFilterOptions loads public project skills and tags', async () => {
    const fixture = createModelFixture(['models', 'projects.ts']);

    await fixture.model.getFilterOptions();

    assert.equal(hasOperation(fixture.operations, 'from skills s inner join project_skills'), true);
    assert.equal(hasOperation(fixture.operations, 'from tags t inner join project_tags'), true);
    assert.equal(hasOperation(fixture.operations, 'where p.is_published = 1'), true);
});

test('project list mapper exposes catalog-friendly aliases', () => {
    const { mapProjectListItem } = loadProjectCommon();

    const mapped = mapProjectListItem({
        id: 10,
        title: 'Shop Portfolio',
        summary: '프로젝트 기본 설명',
        catalog_summary: '프로젝트 카탈로그 설명',
        catalog_label: 'Best Item',
        catalog_status: '출시 완료',
        primary_image_url: 'https://image.example.com/catalog.png',
        slug: 'shop-portfolio',
        demo_url: 'https://demo.example.com',
        is_featured: 1,
        status: 'completed',
        skills: 'Next.js, TypeScript',
        tags: 'frontend, portfolio',
        images: 'https://image.example.com/one.png,https://image.example.com/two.png'
    });

    assert.equal(mapped.project_url, 'https://demo.example.com');
    assert.equal(mapped.demo_url, 'https://demo.example.com');
    assert.equal(mapped.image_url, 'https://image.example.com/catalog.png');
    assert.equal(mapped.catalog_summary, '프로젝트 카탈로그 설명');
    assert.equal(mapped.catalog_label, 'Best Item');
    assert.equal(mapped.catalog_status, '출시 완료');
    assert.deepEqual(mapped.catalog, {
        title: 'Shop Portfolio',
        summary: '프로젝트 카탈로그 설명',
        label: 'Best Item',
        status: '출시 완료',
        badge: null,
        image_url: 'https://image.example.com/catalog.png',
        image_alt: null,
        accent_color: null,
        cta_label: '상세 보기',
        priority: 0,
        price_label: 'Portfolio',
        difficulty_label: null,
        impact_summary: null,
        primary_metric: null
    });
    assert.deepEqual(mapped.skills, ['Next.js', 'TypeScript']);
    assert.deepEqual(mapped.tags, ['frontend', 'portfolio']);
    assert.deepEqual(mapped.images, [
        'https://image.example.com/one.png',
        'https://image.example.com/two.png'
    ]);
});

test('project detail mapper keeps relation objects and adds URL aliases', () => {
    const { mapProjectDetailItem } = loadProjectCommon();

    const mapped = mapProjectDetailItem({
        id: 11,
        title: 'Admin Workflow',
        summary: '관리자 경험 개선',
        is_featured: 0,
        status: 'in_progress'
    }, {
        skills: [{ id: 1, name: 'Node.js' }],
        tags: [{ id: 2, name: 'backend' }],
        images: [{ image_url: 'https://image.example.com/detail.png' }],
        links: [{ link_type: 'demo', url: 'https://admin.example.com' }],
        metrics: [{ label: 'FCP', value: '1.0s' }]
    });

    assert.equal(mapped.demo_url, 'https://admin.example.com');
    assert.equal(mapped.project_url, 'https://admin.example.com');
    assert.equal(mapped.image_url, 'https://image.example.com/detail.png');
    assert.equal(mapped.catalog_summary, '관리자 경험 개선');
    assert.equal(mapped.catalog_label, '프로젝트');
    assert.equal(mapped.catalog_status, '제작 중');
    assert.deepEqual(mapped.skills, [{ id: 1, name: 'Node.js' }]);
    assert.deepEqual(mapped.tags, [{ id: 2, name: 'backend' }]);
    assert.deepEqual(mapped.metrics, [{ label: 'FCP', value: '1.0s' }]);
});

test('Projects.update can explicitly clear project links through project_url', async () => {
    const fixture = createModelFixture(['models', 'projects.ts']);

    await fixture.model.update(20, { project_url: '' });

    assert.equal(hasOperation(fixture.operations, 'delete from project_links where project_id = ?'), true);
    assert.equal(hasOperation(fixture.operations, 'insert into project_links'), false);
});

test('Projects.update can store block content fields', async () => {
    const fixture = createModelFixture(['models', 'projects.ts']);

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
        '<p>수정 내용</p>',
        JSON.stringify([{ type: 'paragraph', content: '수정 내용' }]),
        '수정 내용',
        20
    ]);
});

test('Projects.update normalizes string tags and can clear all tags', async () => {
    const fixture = createModelFixture(['models', 'projects.ts']);

    await fixture.model.update(20, { tags: 'backend, node' });

    assert.equal(hasOperation(fixture.operations, 'delete from project_tags where project_id = ?'), true);
    const tagSelects = fixture.operations.filter((operation) => operation.sql.includes('select id from tags where name = ?'));
    assert.deepEqual(tagSelects.map((operation) => operation.params), [['backend'], ['node']]);

    fixture.operations.length = 0;
    await fixture.model.update(20, { tags: null });

    assert.equal(hasOperation(fixture.operations, 'delete from project_tags where project_id = ?'), true);
    assert.equal(hasOperation(fixture.operations, 'insert ignore into project_tags'), false);
});

test('Projects.delete removes child rows and recalculates tag counts in one transaction', async () => {
    const fixture = createModelFixture(['models', 'projects.ts']);

    await fixture.model.delete(20);

    assert.equal(fixture.transactionCount, 1);
    assert.equal(hasOperation(fixture.operations, 'delete from project_catalog_section_items where project_id = ?'), true);
    assert.equal(hasOperation(fixture.operations, 'delete from project_metrics where project_id = ?'), true);
    assert.equal(hasOperation(fixture.operations, 'delete from project_links where project_id = ?'), true);
    assert.equal(hasOperation(fixture.operations, 'delete from project_skills where project_id = ?'), true);
    assert.equal(hasOperation(fixture.operations, 'delete from project_images where project_id = ?'), true);
    assert.equal(hasOperation(fixture.operations, 'delete from project_tags where project_id = ?'), true);
    assert.equal(hasOperation(fixture.operations, 'delete from project_catalog_profiles where project_id = ?'), true);
    assert.equal(hasOperation(fixture.operations, 'delete from projects where id = ?'), true);
    assert.equal(hasOperation(fixture.operations, 'update tags t left join'), true);
});

test('Projects.replaceCatalogSectionItems replaces section items in one transaction', async () => {
    const fixture = createModelFixture(['models', 'projects.ts']);

    await fixture.model.replaceCatalogSectionItems(7, [
        {
            project_id: 10,
            display_order: 0,
            custom_label: '대표',
            custom_summary: null
        },
        {
            project_id: 11,
            display_order: 2,
            custom_label: null,
            custom_summary: '케이스 스터디'
        }
    ]);

    assert.equal(fixture.transactionCount, 1);
    assert.equal(hasOperation(fixture.operations, 'delete from project_catalog_section_items where section_id = ?'), true);
    const inserts = fixture.operations.filter((operation) => operation.sql.includes('insert into project_catalog_section_items'));
    assert.equal(inserts.length, 2);
    assert.deepEqual(inserts[0].params, [7, 10, 0, '대표', null]);
    assert.deepEqual(inserts[1].params, [7, 11, 2, null, '케이스 스터디']);
});
