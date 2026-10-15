const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const mysql = require('mysql2/promise');
const { stubRootModule, createNoopLogger, rootDir } = require('./helpers/module-loader');

stubRootModule(['log.ts'], createNoopLogger());
const { runMigration } = require('../migrations/init.ts');
const migrationNames = [
    '001_schema.sql', '002_seed_admin.ts', '003_admin_sessions.sql',
    '004_blog_block_content.ts', '005_project_block_content.ts'
];

const createFixture = (t, { applied = [], failSql } = {}) => {
    const names = new Set(applied);
    const statements = [];
    const recorded = [];
    let closed = 0;
    const connection = {
        async execute(sql, params = []) {
            const normalized = sql.replace(/\s+/g, ' ').trim();
            statements.push({ sql: normalized, params });
            if (normalized.startsWith('SELECT id FROM schema_migrations')) {
                return [params.some(name => names.has(name)) ? [{ id: 1 }] : []];
            }
            if (failSql && normalized.includes(failSql)) throw new Error('migration failed');
            if (normalized.startsWith('INSERT INTO schema_migrations')) {
                assert.equal(names.has(params[0]), false, '같은 이름을 두 번 기록하면 안 된다');
                names.add(params[0]);
                recorded.push(params[0]);
            }
            return [normalized.startsWith('SELECT') ? [] : { affectedRows: 1, insertId: 1 }];
        },
        async end() { closed += 1; }
    };
    t.mock.method(mysql, 'createConnection', async () => connection);
    for (const [key, value] of Object.entries({
        ADMIN_BOOTSTRAP_USERNAME: 'migration-test-admin',
        ADMIN_BOOTSTRAP_EMAIL: 'migration@example.test',
        ADMIN_BOOTSTRAP_PASSWORD: 'migration-test-password'
    })) {
        const previous = process.env[key];
        process.env[key] = value;
        t.after(() => {
            if (previous === undefined) delete process.env[key];
            else process.env[key] = previous;
        });
    }
    return { names, statements, recorded, clearFailure() { failSql = undefined; }, get closed() { return closed; } };
};

test('실제 마이그레이션 진입점은 SQL과 TS seed/콘텐츠 변경을 순서대로 실행하고 재실행을 건너뛴다', async (t) => {
    const fixture = createFixture(t);
    await runMigration();
    assert.deepEqual(fixture.recorded, migrationNames);
    assert.ok(fixture.statements.some(({ sql }) => sql.startsWith('INSERT INTO admin_users')));
    assert.ok(fixture.statements.some(({ sql }) => sql.startsWith('INSERT INTO admin_permissions')));
    for (const table of ['blog_posts', 'projects']) {
        for (const column of ['content_json', 'content_html', 'content_text']) {
            assert.ok(fixture.statements.some(({ sql }) => sql.startsWith(`ALTER TABLE ${table} ADD COLUMN ${column} `)));
        }
    }
    const mutations = fixture.statements.filter(({ sql }) => /^(INSERT|ALTER|CREATE TABLE IF NOT EXISTS (?!schema_migrations))/.test(sql)).length;
    await runMigration();
    assert.deepEqual(fixture.recorded, migrationNames);
    assert.equal(fixture.statements.filter(({ sql }) => /^(INSERT|ALTER|CREATE TABLE IF NOT EXISTS (?!schema_migrations))/.test(sql)).length, mutations);
    assert.equal(fixture.closed, 2);
});

test('이전 JS 적용 기록은 같은 이름의 TS 마이그레이션 재실행을 막는다', async (t) => {
    const applied = ['001_schema.sql', '002_seed_admin.js', '003_admin_sessions.sql', '004_blog_block_content.js', '005_project_block_content.js'];
    const fixture = createFixture(t, { applied });
    await runMigration();
    assert.deepEqual(fixture.recorded, []);
    assert.deepEqual([...fixture.names], applied, '기존 이력을 변경하지 않는다');
    assert.equal(fixture.statements.some(({ sql }) => /^(INSERT|ALTER)/.test(sql)), false);
    assert.equal(fixture.closed, 1);
});

test('TS와 JS 파일이 함께 있으면 동일 마이그레이션을 한 번만 실행한다', async (t) => {
    const fixture = createFixture(t);
    const readdirSync = fs.readdirSync;
    t.mock.method(fs, 'readdirSync', (directory, ...args) => {
        const files = readdirSync(directory, ...args);
        return path.resolve(String(directory)) === path.join(rootDir, 'migrations')
            ? [...files, '002_seed_admin.js', '004_blog_block_content.js', '005_project_block_content.js']
            : files;
    });
    await runMigration();
    assert.deepEqual(fixture.recorded, migrationNames);
    assert.equal(fixture.statements.filter(({ sql }) => sql.startsWith('INSERT INTO admin_users')).length, 1);
});

test('TS 마이그레이션 실패는 적용 기록을 남기지 않고 연결을 닫으며 재시도가 가능하다', async (t) => {
    const fixture = createFixture(t, { failSql: 'ALTER TABLE blog_posts ADD COLUMN content_json' });
    await assert.rejects(runMigration(), /migration failed/);
    assert.deepEqual(fixture.recorded, migrationNames.slice(0, 3));
    assert.equal(fixture.names.has('004_blog_block_content.ts'), false);
    assert.equal(fixture.names.has('005_project_block_content.ts'), false);
    assert.equal(fixture.closed, 1);
    fixture.clearFailure();
    await runMigration();
    assert.deepEqual(fixture.recorded, migrationNames);
    assert.equal(fixture.closed, 2);
});
