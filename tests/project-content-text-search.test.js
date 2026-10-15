const test = require('node:test');
const assert = require('node:assert/strict');
const { createModelFixture } = require('./helpers/content-model-fixture');

// Node 22+에서는 실제 메모리 SQL을 실행한다. CI의 Node 20에서도 동일한
// 상태/바인딩 테스트가 실행되도록 해당 WHERE 조건만 평가하는 DB 경계를 둔다.
let DatabaseSync;
try { ({ DatabaseSync } = require('node:sqlite')); } catch (error) {
    if (error.code !== 'ERR_UNKNOWN_BUILTIN_MODULE') throw error;
}

const rows = [
    { id: 1, title: '블록 프로젝트', description: '요약', content: '', content_text: '블록본문전용어', is_published: 1, is_featured: 1 },
    { id: 2, title: '비공개 블록', description: '요약', content: '', content_text: '블록본문전용어', is_published: 0, is_featured: 1 },
    { id: 3, title: '다른 프로젝트', description: '설명전용어', content: '기존본문전용어', content_text: '다른 블록', is_published: 1, is_featured: 0 }
];

const createSearchFixture = (t, useSqlite) => {
    let database;
    if (useSqlite) {
        database = new DatabaseSync(':memory:');
        t.after(() => database.close());
        database.exec(`
            CREATE TABLE projects (
                id INTEGER PRIMARY KEY, title TEXT, description TEXT, short_description TEXT,
                detailed_description TEXT, content TEXT, content_text TEXT, technologies TEXT,
                is_published INTEGER, is_featured INTEGER, created_at TEXT, display_order INTEGER
            );
            CREATE TABLE project_skills (project_id INTEGER, skill_id INTEGER);
            CREATE TABLE skills (id INTEGER, name TEXT);
            CREATE TABLE tag_usage (content_type TEXT, content_id INTEGER, tag_id INTEGER);
            CREATE TABLE tags (id INTEGER, name TEXT, slug TEXT);
            CREATE TABLE project_images (id INTEGER PRIMARY KEY, project_id INTEGER, image_url TEXT, display_order INTEGER);
        `);
        const insert = database.prepare('INSERT INTO projects (id, title, description, content, content_text, is_published, is_featured) VALUES (?, ?, ?, ?, ?, ?, ?)');
        for (const row of rows) insert.run(row.id, row.title, row.description, row.content, row.content_text, row.is_published, row.is_featured);
        database.exec(`
            INSERT INTO skills (id, name) VALUES (1, 'Node.js');
            INSERT INTO project_skills (project_id, skill_id) VALUES (1, 1);
            INSERT INTO project_images (project_id, image_url, display_order) VALUES (1, '/uploads/project.png', 0);
        `);
    }

    const execute = async (query, params) => {
        if (database) return database.prepare(query).all(...params).map(row => ({ ...row }));
        const sql = query.replace(/\s+/g, ' ').toLowerCase();
        if (sql.includes('from project_skills ps inner join skills s')) {
            return params.includes(1) ? [{ project_id: 1, name: 'Node.js' }] : [];
        }
        if (sql.includes('from project_images')) {
            return params.includes(1) ? [{ project_id: 1, image_url: '/uploads/project.png' }] : [];
        }
        if (!sql.includes('from projects p')) return [];
        const fields = [...sql.matchAll(/p\.(\w+) like \?/g)].map(match => match[1]);
        let selected = rows.filter(row => {
            if (sql.includes('p.is_published = 1') && row.is_published !== 1) return false;
            if (sql.includes('p.is_published = 0') && row.is_published !== 0) return false;
            const searchOffset = sql.includes('p.is_featured = ?') ? 1 : 0;
            if (searchOffset && row.is_featured !== params[0]) return false;
            return fields.some((field, index) => String(row[field] || '').includes(params[searchOffset + index].slice(1, -1)));
        });
        if (sql.includes('count(distinct p.id)')) return [{ total: selected.length }];
        selected = selected.slice(params.at(-1), params.at(-1) + params.at(-2));
        return selected.map(row => ({ ...row, tags: null,
            images: row.id === 1 ? '/uploads/project.png' : null
        }));
    };
    return createModelFixture(['models', 'projects.ts'], { execute });
};

for (const engine of DatabaseSync ? ['SQLite', 'Node20 호환 상태'] : ['Node20 호환 상태']) {
    test(`프로젝트 목록과 카운트는 content_text에만 있는 검색어를 찾고 공개 조건을 유지한다 [${engine}]`, async t => {
        const { model } = createSearchFixture(t, engine === 'SQLite');
        const filters = { search: '블록본문전용어', featured: true };
        const list = await model.getWithFilters(filters);
        assert.deepEqual(list.map(row => row.id), [1]);
        assert.equal(await model.getCountWithFilters(filters), 1);
        assert.equal(list[0].long_description, '블록본문전용어');
        assert.deepEqual(list[0].skills, ['Node.js']);
        assert.deepEqual(list[0].images, ['/uploads/project.png']);
        assert.deepEqual(list[0].tags, []);
    });

    test(`관리자 전체 및 초안 검색에서도 content_text 조건과 카운트가 일치한다 [${engine}]`, async t => {
        const { model } = createSearchFixture(t, engine === 'SQLite');
        const all = { search: '블록본문전용어', status: 'all', published_only: false };
        assert.deepEqual((await model.getWithFilters(all)).map(row => row.id).sort(), [1, 2]);
        assert.equal(await model.getCountWithFilters(all), 2);
        const drafts = { search: '블록본문전용어', status: 'draft' };
        assert.deepEqual((await model.getWithFilters(drafts)).map(row => row.id), [2]);
        assert.equal(await model.getCountWithFilters(drafts), 1);
    });

    for (const search of ['설명전용어', '기존본문전용어']) {
        test(`프로젝트 검색은 ${search}가 있는 기존 설명과 본문도 계속 검색한다 [${engine}]`, async t => {
            const { model } = createSearchFixture(t, engine === 'SQLite');
            assert.deepEqual((await model.getWithFilters({ search })).map(row => row.id), [3]);
            assert.equal(await model.getCountWithFilters({ search }), 1);
        });
    }
}
