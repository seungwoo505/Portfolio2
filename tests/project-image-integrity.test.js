const test = require('node:test');
const assert = require('node:assert/strict');
const { createProjectListFixture } = require('./helpers/project-list-fixture');
const { loadPublicRoute } = require('./helpers/public-route-loader');
const { requestJson } = require('./helpers/http-route-server');

const commaUrl = 'https://example.com/images/screenshot,desktop.png';

// URL 쉼표 분리나 GROUP_CONCAT 집계가 복귀하면 실제 모델 응답이 달라진다.
for (const method of ['getAll', 'getWithFilters', 'getFeatured']) {
    test(`projects.${method}: 쉼표 포함 이미지 URL을 상세와 같은 한 항목으로 반환한다`, async () => {
        const { model } = createProjectListFixture();
        await model.addImage(1, commaUrl, '화면', 0);
        const item = (await model[method]()).find(project => project.id === 1);
        assert.deepEqual(item.images, [commaUrl]);
        assert.deepEqual((await model.getById(1)).images.map(image => image.image_url), [commaUrl]);
        assert.deepEqual(item.tags, ['설계, 구현']);
        assert.deepEqual(item.skills, []);
    });
}

test('이미지를 노출 순서대로 정렬하고 중복 URL을 제거하며 1024바이트 이상 보존한다', async () => {
    const { model } = createProjectListFixture();
    // 각 URL은 실제 VARCHAR(500) 범위이며 전체 길이만 집계 기본 제한을 넘는다.
    const longA = `https://example.com/${'a'.repeat(380)}.png`;
    const longB = `https://example.com/${'b'.repeat(380)}.png`;
    const longC = `https://example.com/${'c'.repeat(380)}.png`;
    await model.addImage(1, 'https://example.com/last.png', null, 30);
    await model.addImage(1, commaUrl, null, 10);
    await model.addImage(1, commaUrl, '중복', 40);
    await model.addImage(1, longC, null, 25);
    await model.addImage(1, longA, null, 15);
    await model.addImage(1, longB, null, 20);
    const list = await model.getAll();
    assert.deepEqual(list[0].images, [commaUrl, longA, longB, longC, 'https://example.com/last.png']);
    assert.deepEqual(list[1].images, []);
});

test('프로젝트 한 페이지의 이미지·기술·태그를 각각 한 번 조회한다', async () => {
    const { model, operations } = createProjectListFixture({ count: 50 });
    await model.addImage(1, commaUrl);
    await model.addImage(2, 'https://example.com/second.png');
    await model.addImage(3, 'https://example.com/next-page.png');
    await model.addSkill(1, 1);
    operations.length = 0;
    const list = await model.getAll(2, 0);
    assert.deepEqual(list.map(project => project.images), [[commaUrl], ['https://example.com/second.png']]);
    assert.deepEqual(list[0].skills, ['CI, CD']);
    assert.deepEqual(list[0].tags, ['설계, 구현']);
    const imageQueries = operations.filter(operation => operation.sql.includes('from project_images'));
    assert.equal(imageQueries.length, 1, '페이지 전체에 이미지 조회 한 번이 필요하다');
    assert.deepEqual(imageQueries[0].params, [1, 2], '다른 페이지의 관계는 읽지 않는다');
    assert.equal(operations.length, 4, '목록과 기술·태그·이미지의 네 쿼리로 처리한다');
});

test('프로젝트 목록이 비면 이미지 관계도 조회하지 않는다', async () => {
    const { model, operations } = createProjectListFixture({ count: 0 });
    assert.deepEqual(await model.getAll(), []);
    assert.equal(operations.length, 1);
});

test('공개 프로젝트 목록·상세 HTTP 응답이 쉼표 포함 이미지 URL을 보존한다', async () => {
    const { model } = createProjectListFixture();
    await model.addImage(1, commaUrl);
    const router = loadPublicRoute({ Projects: model });
    const list = await requestJson(router, '/projects');
    assert.equal(list.status, 200);
    assert.deepEqual(list.body.data[0].images, [commaUrl]);
    const detail = await requestJson(router, '/projects/project-1');
    assert.equal(detail.status, 200);
    assert.deepEqual(detail.body.data.images.map(image => image.image_url), [commaUrl]);
});
