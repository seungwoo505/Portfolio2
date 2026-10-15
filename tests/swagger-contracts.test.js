const test = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const SwaggerParser = require('@apidevtools/swagger-parser');
const Ajv = require('ajv');
const { stubRootModule, createNoopLogger } = require('./helpers/module-loader');
const { requestJson, startRouterServer } = require('./helpers/http-route-server');

let execute = async () => { throw new Error('허용하지 않은 DB 호출'); };
stubRootModule(['log.ts'], createNoopLogger());
stubRootModule(['db.ts'], { execute: (...args) => execute(...args) });
stubRootModule(['middleware', 'auth.ts'], {
    authenticateToken: (_req, _res, next) => next(),
    requirePermission: () => (_req, _res, next) => next(),
    logActivity: () => (_req, _res, next) => next()
});
const { createSwaggerSpec, mountSwaggerDocs } = require('../config/swagger.ts');
const getSpec = () => createSwaggerSpec({ port: 3333 });
const dereference = () => SwaggerParser.dereference(getSpec(), { resolve: { external: false } });
const validator = schema => new Ajv({ strict: false, allErrors: true, validateFormats: false }).compile(schema);
const assertResponseMatches = (spec, path, method, response) => {
    const schema = spec.paths[path][method].responses[String(response.status)].content['application/json'].schema;
    const validate = validator(schema);
    assert.equal(validate(response.body), true, JSON.stringify(validate.errors));
};

test('MY_HOST가 프런트엔드 주소여도 문서는 현재 API 서버로만 요청한다', async () => {
    const original = { NODE_ENV: process.env.NODE_ENV, MY_HOST: process.env.MY_HOST };
    let server;
    try {
        process.env.NODE_ENV = 'production';
        process.env.MY_HOST = 'https://frontend.example.test';
        const app = express();
        require('../config/security.ts').configureSecurityMiddleware(app);
        mountSwaggerDocs(app, { port: 3333 });
        app.get('/health', (_req, res) => res.json({ status: 'healthy' }));
        server = await startRouterServer(app);

        const response = await fetch(server.baseUrl + '/api-docs.json');
        assert.equal(response.status, 200);
        assert.match(response.headers.get('content-security-policy'), /connect-src 'self'(?:;|$)/);
        const spec = await response.json();
        assert.ok(spec.servers.length > 0);
        for (const entry of spec.servers) {
            const target = new URL(entry.url.replace(/\/$/, '') + '/health', server.baseUrl + '/api-docs/');
            assert.equal(target.origin, new URL(server.baseUrl).origin, '다른 서버로 요청을 보내면 안 된다');
            assert.equal(target.pathname, '/health');
            const health = await fetch(target);
            assert.equal(health.status, 200);
            assert.deepEqual(await health.json(), { status: 'healthy' });
        }
    } finally {
        if (server) await server.close();
        for (const [key, value] of Object.entries(original)) {
            if (value === undefined) delete process.env[key];
            else process.env[key] = value;
        }
    }
});

const experienceRows = [1, 0, null].map((is_current, index) => ({
    id: index + 1, type: 'work', title: '개발자', company_or_institution: 'Example',
    location: null, description: null, start_date: '2026-01-01', end_date: null,
    is_current, display_order: 0, created_at: '2026-01-01 00:00:00', updated_at: '2026-01-01 00:00:00'
}));

test('경력 목록·타임라인의 실제 모델 응답이 0/1/null 문서와 일치한다', async () => {
    execute = async sql => {
        assert.match(sql, /FROM experiences/);
        const rows = sql.includes('end_date_formatted')
            ? experienceRows.map(row => ({ ...row, start_date_formatted: '2026.01', end_date_formatted: row.is_current ? '현재' : '진행중' }))
            : experienceRows;
        return [rows, []];
    };
    const spec = await dereference();
    for (const [file, path] of [
        ['collection.ts', '/experiences'], ['timeline.ts', '/experiences/timeline']
    ]) {
        const result = await requestJson(require('../routes/admin/experiences/' + file), path);
        assert.equal(result.status, 200);
        assert.deepEqual(result.body.data.map(row => row.is_current), [1, 0, null]);
        assertResponseMatches(spec, '/admin' + path, 'get', result);
    }
});

test('경력 생성·수정 문서는 boolean 입력과 DB 상태값 응답을 구분한다', async () => {
    const spec = await dereference();
    for (const [path, method, status] of [
        ['/admin/experiences', 'post', 201], ['/admin/experiences/{id}', 'put', 200]
    ]) {
        const validateInput = validator(spec.paths[path][method].requestBody.content['application/json'].schema);
        assert.equal(validateInput({ type: 'work', title: '개발자', is_current: true }), true);
        for (const row of experienceRows) {
            assertResponseMatches(spec, path, method, { status, body: { success: true, data: row } });
        }
    }
});

test('설정의 실제 모델 응답이 0/1/null 공개 여부 문서와 일치한다', async () => {
    execute = async sql => {
        assert.match(sql, /FROM site_settings/);
        return [[1, 0, null].map((is_public, index) => ({
            setting_key: 'site_title_' + index, setting_value: 'Portfolio', setting_type: 'string',
            is_public, description: null, updated_at: '2026-10-15 12:00:00'
        })), []];
    };
    const result = await requestJson(require('../routes/admin/settings.ts'), '/settings');
    assert.equal(result.status, 200);
    assert.deepEqual(Object.values(result.body.data).map(value => value.is_public), [1, 0, null]);
    assertResponseMatches(await dereference(), '/admin/settings', 'get', result);
});

test('공개 API가 실제 기능별 분류에 연결되고 빈 분류는 없다', () => {
    const spec = getSpec();
    const publicTags = [
        ['/public/posts', 'Blog'], ['/public/projects', 'Projects'], ['/public/profile', 'Profile'],
        ['/public/settings', 'Settings'], ['/public/social-links', 'Social'], ['/public/skills', 'Skills'],
        ['/public/tags', 'Tags'], ['/public/experiences', 'Experiences'], ['/public/contact', 'Contact'],
        ['/public/interests', 'Interests']
    ];
    const declared = new Set(spec.tags.map(tag => tag.name));
    const used = new Set();
    for (const [path, item] of Object.entries(spec.paths)) {
        for (const operation of Object.values(item)) {
            if (!operation.responses) continue;
            for (const tag of operation.tags) {
                assert.ok(declared.has(tag), '선언되지 않은 분류: ' + tag);
                used.add(tag);
            }
            if (path.startsWith('/public/')) {
                const [, expected] = publicTags.find(([prefix]) => path === prefix || path.startsWith(prefix + '/'));
                assert.deepEqual(operation.tags, [expected], path + ': 잘못된 분류');
            }
        }
    }
    assert.deepEqual([...declared].filter(tag => !used.has(tag)), [], '사용하지 않는 분류는 화면에 빈 목록을 만든다');
    const publicGroup = spec['x-tagGroups'].find(group => group.name === '공개 API');
    assert.ok(!publicGroup.tags.includes('Monitoring'), '인증이 필요한 모니터링을 공개 API로 안내하면 안 된다');
    for (const group of spec['x-tagGroups']) {
        for (const tag of group.tags) assert.ok(used.has(tag), group.name + ': 빈 분류 ' + tag);
    }
});
