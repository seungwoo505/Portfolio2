const test = require('node:test');
const assert = require('node:assert/strict');
const os = require('node:os');
const express = require('express');
const SwaggerParser = require('@apidevtools/swagger-parser');
const Ajv = require('ajv');
const { stubRootModule, createNoopLogger } = require('./helpers/module-loader');
const { startRouterServer } = require('./helpers/http-route-server');

stubRootModule(['log.ts'], createNoopLogger());
stubRootModule(['db.ts'], { execute: async () => { throw new Error('문서 검사 중 DB 호출 금지'); } });
const { createSwaggerSpec, mountSwaggerDocs } = require('../config/swagger.ts');
const methods = ['get', 'post', 'put', 'patch', 'delete'];
const operations = spec => Object.entries(spec.paths || {}).flatMap(([path, item]) => (
    methods.filter(method => item[method]).map(method => ({ path, method, operation: item[method], pathItem: item }))
));
const getSpec = () => createSwaggerSpec({ port: 3333 });

const assertResponseMatches = (spec, path, method, response) => {
    const schema = spec.paths[path][method].responses[String(response.status)].content['application/json'].schema;
    const validate = new Ajv({ strict: false, allErrors: true, validateFormats: false }).compile(schema);
    assert.equal(validate(response.body), true, JSON.stringify(validate.errors));
};

const runtimeOperations = () => {
    const found = [];
    const walk = (router, prefix) => {
        for (const layer of router.stack || []) {
            if (layer.route) {
                for (const method of Object.keys(layer.route.methods)) {
                    found.push(`${method} ${prefix}${layer.route.path.replace(/:([A-Za-z_]\w*)/g, '{$1}')}`);
                }
            } else if (layer.handle?.stack) walk(layer.handle, prefix);
        }
    };
    for (const family of ['public', 'admin', 'monitoring']) walk(require(`../routes/${family}.ts`), '/' + family);
    for (const layer of require('../app.ts').app.router.stack) {
        if (layer.route && layer.route.path !== '/api-docs.json') walk({ stack: [layer] }, '');
    }
    return found.sort();
};

test('Swagger 명세는 실행 중인 모든 API 작업과 정확히 일치한다', () => {
    const documented = operations(getSpec()).map(({ path, method }) => `${method} ${path}`).sort();
    assert.ok(documented.length > 0, '빈 API 문서를 성공으로 처리하면 안 된다');
    assert.deepEqual(documented, runtimeOperations());
});

test('작업 디렉터리가 바뀌어도 Swagger 라우트 주석을 찾는다', () => {
    const cwd = process.cwd();
    try {
        process.chdir(os.tmpdir());
        assert.ok(getSpec().paths['/public/projects'], '문서 경로는 cwd에 의존하면 안 된다');
    } finally { process.chdir(cwd); }
});

test('서버 기본 검사도 빈 API 명세를 실패로 처리한다', () => {
    const swagger = require('../config/swagger.ts');
    const original = swagger.createSwaggerSpec;
    try {
        swagger.createSwaggerSpec = () => ({ openapi: '3.0.0', paths: {} });
        assert.throws(() => require('../scripts/check/swagger.ts').checkSwaggerServerConfig(), /API|Swagger/);
    } finally { swagger.createSwaggerSpec = original; }
});

test('전체 문서는 외부 참조 없이 OpenAPI 3.0 검증을 통과한다', async () => {
    await SwaggerParser.validate(getSpec(), { resolve: { external: false } });
});

test('모든 작업에는 응답과 필수 URL 경로 변수 입력 정의가 있다', () => {
    const spec = getSpec();
    assert.ok(operations(spec).length > 0, '검사할 작업이 있어야 한다');
    for (const { path, method, operation, pathItem } of operations(spec)) {
        assert.ok(Object.keys(operation.responses || {}).length > 0, `${method} ${path}: 응답 누락`);
        for (const [, name] of path.matchAll(/\{([^}]+)\}/g)) {
            const parameter = [...(pathItem.parameters || []), ...(operation.parameters || [])]
                .find(item => item.in === 'path' && item.name === name);
            assert.ok(parameter?.required === true && parameter.schema, `${method} ${path}: ${name} 필수 입력 누락`);
        }
    }
});

test('보호된 관리자·모니터링 API는 Authorize 토큰을 사용하고 공개 API는 요구하지 않는다', () => {
    const spec = getSpec();
    assert.ok(operations(spec).length > 0, '검사할 작업이 있어야 한다');
    for (const { path, method, operation } of operations(spec)) {
        const protectedRoute = (path.startsWith('/admin/') && !['/admin/login', '/admin/refresh'].includes(path))
            || path.startsWith('/monitoring/');
        const usesBearer = (operation.security || spec.security || []).some(item => item.bearerAuth);
        assert.equal(usesBearer, protectedRoute, `${method} ${path}: 인증 문서가 실제 접근 조건과 다름`);
    }
});

test('본문을 받는 API는 입력 모델을 제공하고 무본문 API에는 불필요한 모델이 없다', () => {
    const noBody = new Set([
        'post /public/projects/{slug}/view', 'post /public/posts/{slug}/view',
        'post /admin/logout', 'put /admin/contacts/{id}/read'
    ]);
    const spec = getSpec();
    assert.ok(operations(spec).length > 0, '검사할 작업이 있어야 한다');
    for (const { path, method, operation } of operations(spec)) {
        if (!['post', 'put', 'patch'].includes(method)) continue;
        const key = `${method} ${path}`;
        if (noBody.has(key)) assert.equal(operation.requestBody, undefined, `${key}: 실제 요청은 본문이 없음`);
        else {
            const mediaType = path === '/admin/upload/image' ? 'multipart/form-data' : 'application/json';
            assert.ok(operation.requestBody?.content?.[mediaType]?.schema, `${key}: 요청 입력 모델 누락`);
        }
    }
});

test('설명은 Markdown 제목과 목록으로 표시 가능한 형태이다', () => {
    const description = getSpec().info.description;
    assert.match(description, /^\*\*포트폴리오/);
    assert.match(description, /^## 주요 기능$/m);
    assert.doesNotMatch(description, /^ {4}\S/m);
});

test('로그인 응답 문서는 실제 data 래핑과 토큰·권한 목록을 설명한다', async () => {
    const spec = await SwaggerParser.dereference(getSpec(), { resolve: { external: false } });
    const { loadAuthRoute, requestJson } = require('./helpers/admin-auth-route-loader');
    const router = loadAuthRoute({ AdminUsers: {
        login: async () => ({ token: 'test-access', refreshToken: 'test-refresh', user: { id: 1, username: 'admin', role: 'admin' } }),
        getUserPermissions: async () => [{ name: 'dashboard.read', resource: 'dashboard', action: 'read', description: '조회' }]
    } });
    const result = await requestJson(router, '/login', { method: 'POST', body: { username: 'admin', password: 'test-password' } });
    assert.equal(result.status, 200);
    const schema = spec.components.schemas.LoginResponse;
    assert.deepEqual(Object.keys(schema.properties).sort(), Object.keys(result.body).sort());
    for (const field of ['token', 'refreshToken', 'user', 'permissions']) {
        assert.ok(schema.properties.data.properties[field], `data.${field} 문서 누락`);
        assert.ok(Object.hasOwn(result.body.data, field));
    }
    assert.equal(schema.properties.data.properties.permissions.type, 'array');
    assertResponseMatches(spec, '/admin/login', 'post', result);
});

test('공개 목록의 실제 페이징·nullable 응답이 문서 스키마와 일치한다', async () => {
    const spec = await SwaggerParser.dereference(getSpec(), { resolve: { external: false } });
    const { loadPublicRoute } = require('./helpers/public-route-loader');
    const { requestJson } = require('./helpers/http-route-server');
    const router = loadPublicRoute({ Projects: {
        getWithFilters: async () => [{
            id: 1, title: 'Project', slug: 'project', description: null,
            is_published: 1, is_featured: null, featured: false,
            created_at: '2026-10-15 12:00:00', skills: ['Node.js'], tags: ['개발'], images: []
        }],
        getCountWithFilters: async () => '1'
    } });
    const result = await requestJson(router, '/projects?page=1&limit=1');
    assert.equal(result.status, 200);
    assert.equal(result.body.pagination.total, '1');
    assert.ok(Array.isArray(result.body.data));
    assertResponseMatches(spec, '/public/projects', 'get', result);
});

test('문서화한 문의 입력과 실제 201 응답이 서로 일치한다', async () => {
    const spec = await SwaggerParser.dereference(getSpec(), { resolve: { external: false } });
    const { loadPublicRoute } = require('./helpers/public-route-loader');
    const { requestJson } = require('./helpers/http-route-server');
    const body = { name: '방문자', email: 'person@company.net', message: '문서에 맞춘 문의입니다.' };
    const validate = new Ajv({ strict: false, validateFormats: false }).compile(
        spec.paths['/public/contact'].post.requestBody.content['application/json'].schema
    );
    assert.equal(validate(body), true, JSON.stringify(validate.errors));
    const router = loadPublicRoute({ ContactMessages: { createWithRateLimit: async () => 42 } });
    const result = await requestJson(router, '/contact', { method: 'POST', body });
    assert.equal(result.status, 201);
    assertResponseMatches(spec, '/public/contact', 'post', result);
});

test('/api-docs 화면 리소스와 JSON 명세가 정상 제공된다', async () => {
    const app = express();
    mountSwaggerDocs(app, { port: 3333 });
    const server = await startRouterServer(app);
    try {
        const json = await fetch(server.baseUrl + '/api-docs.json');
        assert.equal(json.status, 200);
        assert.ok(operations(await json.json()).length > 0, '빈 명세를 배포하면 안 된다');
        for (const asset of ['/api-docs/', '/api-docs/swagger-ui-init.js', '/api-docs/swagger-ui-bundle.js', '/api-docs/swagger-ui.css']) {
            const response = await fetch(server.baseUrl + asset);
            assert.equal(response.status, 200, asset);
            await response.text();
        }
    } finally { await server.close(); }
});
