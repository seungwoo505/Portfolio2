const test = require('node:test');
const assert = require('node:assert/strict');
const { createContentTagFixture } = require('./helpers/content-tag-fixture');

const commaTag = '설계, 구현';
const create = (family, model, tags) => family === 'projects'
    ? model.create({ title: '태그 보존', content: '본문', is_published: true, is_featured: true, tags })
    : model._create({ title: '태그 보존', content: '본문', is_published: true, is_featured: true, tags });
const update = (family, model, id, tags) => family === 'projects'
    ? model.update(id, { tags }) : model._update(id, { tags });

for (const family of ['projects', 'blog-posts']) {
    test(`${family}: 배열의 쉼표 포함 태그 하나를 생성하고 상세에서 그대로 조회한다`, async () => {
        const { model, tags } = createContentTagFixture(family);
        const id = await create(family, model, [commaTag]);
        assert.deepEqual(tags.map(tag => tag.name), [commaTag]);
        assert.deepEqual((await model.getById(id)).tags.map(tag => tag.name), [commaTag]);
    });

    test(`${family}: 태그 수정도 쉼표 포함 이름을 한 항목으로 보존한다`, async () => {
        const { model } = createContentTagFixture(family);
        const id = await create(family, model, ['기존']);
        await update(family, model, id, [commaTag]);
        assert.deepEqual((await model.getById(id)).tags.map(tag => tag.name), [commaTag]);
    });

    test(`${family}: CSV 문자열 입력과 빈 태그로 초기화를 계속 지원한다`, async () => {
        const { model } = createContentTagFixture(family);
        const id = await create(family, model, 'backend, node');
        assert.deepEqual((await model.getById(id)).tags.map(tag => tag.name), ['backend', 'node']);
        await update(family, model, id, []);
        assert.deepEqual((await model.getById(id)).tags, []);
    });

    for (const method of ['getAll', 'getWithFilters', 'getFeatured']) {
        test(`${family}.${method}: 목록 태그를 상세와 같은 이름 배열로 반환한다`, async () => {
            const { model } = createContentTagFixture(family);
            const id = await create(family, model, [commaTag, 'API "구현"\\경로']);
            const list = await model[method]();
            assert.deepEqual(list.find(row => row.id === id).tags, ['API "구현"\\경로', commaTag]);
        });
    }

    test(`${family}: 여러 콘텐츠의 태그를 섞지 않고 1024자 이상도 목록에서 보존한다`, async () => {
        const { model } = createContentTagFixture(family);
        const names = Array.from({ length: 30 }, (_, index) => `${String(index).padStart(2, '0')}-${'가'.repeat(50)}`);
        const id = await create(family, model, names);
        const otherId = await create(family, model, ['별도 태그']);
        const list = await model.getAll();
        assert.deepEqual(list.find(row => row.id === id).tags, names);
        assert.deepEqual(list.find(row => row.id === otherId).tags, ['별도 태그']);
    });
}

for (const method of ['search', 'getByTag']) {
    test(`blog-posts.${method}: 쉼표를 포함한 태그를 목록에서 보존한다`, async () => {
        const { model, tags } = createContentTagFixture('blog-posts');
        await create('blog-posts', model, [commaTag]);
        const result = await model[method](method === 'getByTag' ? tags[0].slug : '태그 보존');
        assert.deepEqual(result[0].tags, [commaTag]);
    });
}
