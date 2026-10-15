const test = require('node:test');
const assert = require('node:assert/strict');
const bcrypt = require('bcryptjs');
const { createNoopLogger } = require('./helpers/module-loader');
const { up } = require('../migrations/002_seed_admin.ts');

const runSeed = async password => {
    const values = {
        ADMIN_BOOTSTRAP_USERNAME: 'bootstrap',
        ADMIN_BOOTSTRAP_EMAIL: 'bootstrap@company.net',
        ADMIN_BOOTSTRAP_PASSWORD: password
    };
    const previous = Object.fromEntries(Object.keys(values).map(key => [key, process.env[key]]));
    const inserted = [];
    try {
        Object.assign(process.env, values);
        await up({ execute: async (query, params) => {
            const sql = query.replace(/\s+/g, ' ').trim().toLowerCase();
            if (sql.startsWith('select id from admin_users')) return [[]];
            if (sql.startsWith('insert into admin_users')) inserted.push(params);
            return [{ affectedRows: 1 }];
        } }, createNoopLogger());
        return inserted;
    } finally {
        for (const [key, value] of Object.entries(previous)) {
            if (value === undefined) delete process.env[key];
            else process.env[key] = value;
        }
    }
};

test('초기 관리자 생성도 UTF-8 72바이트 초과 비밀번호를 거절한다', async () => {
    await assert.rejects(runSeed('A1' + 'x'.repeat(71)), /72바이트/);
    await assert.rejects(runSeed('A1' + '한'.repeat(24)), /72바이트/);
});

test('72바이트 경계의 초기 관리자 비밀번호는 정상 저장한다', async () => {
    const password = 'A1' + 'x'.repeat(70);
    const inserted = await runSeed(password);
    assert.equal(inserted.length, 1);
    assert.equal(await bcrypt.compare(password, inserted[0][2]), true);
});
