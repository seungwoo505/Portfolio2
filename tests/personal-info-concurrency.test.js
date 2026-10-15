const test = require('node:test');
const assert = require('node:assert/strict');
const { createAtomicModelFixture } = require('./helpers/atomic-model-fixture');
const { loadAdminRoute, requestJson } = require('./helpers/admin-route-loader');

test('개인 정보: 빈 테이블의 동시 PUT은 한 행에 이름과 소개를 합친다', { timeout: 15000 }, async () => {
    const fixture = createAtomicModelFixture({ table: 'personal_info', barrier: true });
    const firstModel = fixture.loadModel('personal-info');
    const secondModel = fixture.loadModel('personal-info');
    const route = model => loadAdminRoute(['routes', 'admin', 'profile.ts'], [{ segments: ['models', 'personal-info.ts'], moduleExports: model }]);
    const firstRouter = route(firstModel);
    const secondRouter = route(secondModel);
    const responses = await Promise.all([
        requestJson(firstRouter, '/personal-info', { method: 'PUT', body: { name: '홍길동' } }),
        requestJson(secondRouter, '/personal-info', { method: 'PUT', body: { bio: '개발자' } })
    ]);
    assert.deepEqual(responses.map(response => response.status), [200, 200]);
    const final = await requestJson(secondRouter, '/personal-info');
    assert.equal(final.body.data.name, '홍길동');
    assert.equal(final.body.data.full_name, '홍길동');
    assert.equal(final.body.data.bio, '개발자');
    assert.equal(fixture.rows.size, 1);
    assert.equal([...fixture.locks.values()].some(lock => lock.owner), false);
});

test('개인 정보: UPDATE 실패 후 잠금을 해제하여 다음 쓰기를 허용한다', async () => {
    const error = new Error('개인 정보 UPDATE 실패');
    const failure = { match: 'update personal_info set ', error };
    const fixture = createAtomicModelFixture({ table: 'personal_info', rows: [{ id: 1, name: '기존' }], queryFailure: failure });
    const model = fixture.loadModel('personal-info');
    await assert.rejects(model.update({ name: '실패' }), issue => issue === error);
    assert.equal([...fixture.locks.values()].some(lock => lock.owner), false);
    failure.match = '존재하지 않는 SQL';
    assert.equal((await model.update({ bio: '다음 쓰기' })).bio, '다음 쓰기');
    assert.equal(fixture.rows.get(1).name, '기존');
});

test('개인 정보: 과거 행은 보존하며 최신 행의 부분 갱신과 별칭/null 초기화를 유지한다', async () => {
    const fixture = createAtomicModelFixture({ table: 'personal_info', rows: [
        { id: 1, name: '과거', bio: '과거 소개' },
        { id: 9, name: '현재', full_name: '현재', bio: '현재 소개', avatar_url: '/old.png' }
    ] });
    const model = fixture.loadModel('personal-info');
    await model.update({ full_name: '새 이름', profile_image: '/new.png' });
    const result = await model.update({ bio: null, profile_image: null });
    assert.equal(result.id, 9);
    assert.equal(result.name, '새 이름');
    assert.equal(result.full_name, '새 이름');
    assert.equal(result.bio, null);
    assert.equal(result.avatar_url, null);
    assert.equal(result.profile_image, null);
    assert.equal(fixture.rows.size, 2);
    assert.deepEqual(fixture.rows.get(1), { id: 1, name: '과거', bio: '과거 소개' });
    assert.deepEqual(await model.update({ unknown: '무시' }), result);
});

for (const options of [
    { lockResult: 0 }, { lockResult: null }, { acquireFailure: true },
    { releaseFailure: true }, { releaseResult: null },
    { insertFailure: new Error('개인 정보 INSERT 실패') }
]) {
    test(`개인 정보: 잠금/쓰기 실패 후 연결과 잠금을 정리한다 ${JSON.stringify(options)}`, async () => {
        const fixture = createAtomicModelFixture({ table: 'personal_info', ...options });
        const model = fixture.loadModel('personal-info');
        if (options.releaseFailure || options.releaseResult === null) await model.update({ name: '정상 저장' });
        else await assert.rejects(model.update({ name: '실패' }));
        assert.equal([...fixture.locks.values()].some(lock => lock.owner), false);
        assert.equal(fixture.connections.every(connection => connection.released || connection.destroyed), true);
        if (options.lockResult === 0) assert.equal(fixture.connections[0].released, true);
        if (options.acquireFailure || options.lockResult === null || options.releaseFailure || options.releaseResult === null) {
            assert.equal(fixture.connections[0].destroyed, true);
        }
    });
}
