const test = require('node:test');
const assert = require('node:assert/strict');
const { stubRootModule, createNoopLogger } = require('./helpers/module-loader');

let state;
let failTagDelete;
let activeConnections = 0;
const executeDelete = async (data, sql, params) => {
    assert.deepEqual(params, [1]);
    if (sql.includes('DELETE FROM tag_usage')) data.links = [];
    else if (sql.includes('DELETE FROM tags')) {
        if (failTagDelete) throw new Error('태그 삭제 중 DB 오류');
        data.tags = [];
    } else throw new Error('예상하지 않은 SQL: ' + sql);
    return [{ affectedRows: 1 }, []];
};
stubRootModule(['log.ts'], createNoopLogger());
stubRootModule(['db.ts'], {
    execute: (sql, params) => executeDelete(state, sql, params),
    getConnection: async () => {
        activeConnections++;
        let pending;
        return {
            beginTransaction: async () => { pending = structuredClone(state); },
            execute: (sql, params) => executeDelete(pending, sql, params),
            commit: async () => { state = pending; },
            rollback: async () => { pending = null; },
            release: () => { activeConnections--; }
        };
    }
});
const Tags = require('../models/tags.ts');
const initialState = () => ({ tags: [{ id: 1, name: 'Node.js' }], links: [{ tag_id: 1, content_id: 7, content_type: 'project' }] });

test('태그 삭제에 실패하면 태그와 콘텐츠 연결이 모두 보존된다', async () => {
    state = initialState();
    failTagDelete = true;
    await assert.rejects(Tags.delete(1), /태그 삭제 중 DB 오류/);
    assert.deepEqual(state, initialState());
    assert.equal(activeConnections, 0);
});

test('태그 삭제에 성공하면 태그와 콘텐츠 연결이 함께 제거된다', async () => {
    state = initialState();
    failTagDelete = false;
    await Tags.delete(1);
    assert.deepEqual(state, { tags: [], links: [] });
    assert.equal(activeConnections, 0);
});
