const test = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const { createMessageHandler } = require('../mcp/src/server/handlers');
const { createProjectListFixture } = require('./helpers/project-list-fixture');
const { loadPublicRoute } = require('./helpers/public-route-loader');
const { startRouterServer } = require('./helpers/http-route-server');

const startMcpApi = async (t, { slug = 'project-1' } = {}) => {
    const fixture = createProjectListFixture();
    fixture.rows[0].slug = slug;
    await fixture.model.addSkill(1, 1);
    await fixture.model.addSkill(2, 2);
    await fixture.model.addSkill(3, 3);
    const requests = [];
    const router = express.Router();
    router.use('/public', (req, _res, next) => {
        requests.push(req.originalUrl);
        next();
    }, loadPublicRoute({
        Projects: fixture.model,
        BlogPosts: {
            getBySlug: async value => value === slug ? {
                id: 1, uuid: null, title: '테스트 글', slug, excerpt: null, content: '본문',
                content_json: null, content_html: null, content_text: '본문', featured_image: null,
                is_featured: 0, is_published: 1, reading_time: 1, view_count: 0,
                published_at: '2026-10-15 00:00:00', created_at: '2026-10-15 00:00:00',
                updated_at: '2026-10-15 00:00:00', tags: []
            } : null,
            getWithFilters: async () => [],
            getCountWithFilters: async () => 0
        }
    }));
    const server = await startRouterServer(router);
    const previousBaseUrl = process.env.PORTFOLIO_API_BASE_URL;
    process.env.PORTFOLIO_API_BASE_URL = server.baseUrl;
    t.after(async () => {
        if (previousBaseUrl === undefined) delete process.env.PORTFOLIO_API_BASE_URL;
        else process.env.PORTFOLIO_API_BASE_URL = previousBaseUrl;
        await server.close();
    });
    return { ...fixture, requests, baseUrl: server.baseUrl };
};

const callTool = async (name, args) => {
    let result;
    const handler = createMessageHandler({
        writeResult: (_id, value) => { result = value; },
        writeError: (_id, code, message) => assert.fail(`${code}: ${message}`)
    });
    await handler({ jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name, arguments: args } });
    assert.ok(result);
    return result;
};

// MCP가 skills 배열을 CSV로 합치면 실제 공개 API가 CI, CD를 두 기술로 나눠 0건이 된다.
for (const { skills, ids, query } of [
    { skills: ['CI, CD'], ids: [1], query: '/public/projects?skills%5B%5D=CI%2C+CD' },
    { skills: [' CI, CD ', 'React'], ids: [1, 2], query: '/public/projects?skills%5B%5D=CI%2C+CD&skills%5B%5D=React' }
]) {
    test(`MCP 프로젝트 기술명 ${JSON.stringify(skills)}이 공개 HTTP API까지 원문 배열로 전달된다`, async t => {
        const api = await startMcpApi(t);
        const result = await callTool('list_projects', { skills });
        assert.equal(result.isError, undefined);
        const payload = JSON.parse(result.content[0].text);
        assert.deepEqual(payload.data.map(project => project.id), ids);
        assert.equal(payload.pagination.total, ids.length);
        assert.deepEqual(payload.data[0].skills, ['CI, CD']);
        assert.deepEqual(api.requests, [query]);
    });
}

test('MCP 프로젝트 배열 필터가 페이지·개수·태그 CSV와 함께 동작한다', async t => {
    const api = await startMcpApi(t);
    const result = await callTool('list_projects', {
        skills: ['CI, CD', 'React', 'Node.js'], limit: 2, page: 2, tags: ['design', 'backend']
    });
    assert.equal(result.isError, undefined);
    const payload = JSON.parse(result.content[0].text);
    assert.deepEqual(payload.data.map(project => project.id), [3]);
    assert.equal(payload.pagination.total, 3);
    assert.equal(payload.pagination.page, 2);
    assert.equal(payload.pagination.limit, 2);
    assert.deepEqual(api.requests, [
        '/public/projects?limit=2&page=2&tags=design%2Cbackend&skills%5B%5D=CI%2C+CD&skills%5B%5D=React&skills%5B%5D=Node.js'
    ]);
});

test('기존 단일 skills CSV 공개 API 호출은 여러 일반 기술을 계속 조회한다', async t => {
    const api = await startMcpApi(t);
    const { apiGet } = require('../mcp/src/server/api');
    const payload = await apiGet('/public/projects', { skills: 'React,Node.js' });
    assert.deepEqual(payload.data.map(project => project.id), [2, 3]);
    assert.deepEqual(api.requests, ['/public/projects?skills=React%2CNode.js']);
});

// 점 경로를 URL이 목록 주소로 정규화하기 전에 MCP 입력 단계에서 차단해야 한다.
for (const { tool, resource } of [
    { tool: 'get_project', resource: 'projects' },
    { tool: 'get_blog_post', resource: 'posts' }
]) {
    test(`MCP ${tool}는 유효하지 않은 slug를 HTTP 요청 전에 도구 오류로 반환한다`, async t => {
        const api = await startMcpApi(t);
        for (const slug of ['.', '..', '/', '%2e', '%2e%2e', 'hello/world', 'bad slug', 'a--b', 'UPPER', 'a'.repeat(256), '   ', 12]) {
            const result = await callTool(tool, { slug });
            assert.equal(result.isError, true, JSON.stringify(slug));
            assert.match(result.content[0].text, /slug/i);
            assert.deepEqual(api.requests, [], JSON.stringify(slug));
        }
    });

    for (const { slug, input, encoded } of [
        { slug: 'project-1', input: '  project-1  ', encoded: 'project-1' },
        { slug: '한글-글', input: ' 한글-글 ', encoded: '%ED%95%9C%EA%B8%80-%EA%B8%80' },
        { slug: 'a'.repeat(255), input: 'a'.repeat(255), encoded: 'a'.repeat(255) }
    ]) {
        test(`MCP ${tool}는 정상 ${slug.length === 255 ? '최대 길이' : slug} slug의 상세 URL과 객체를 반환한다`, async t => {
            const api = await startMcpApi(t, { slug });
            const result = await callTool(tool, { slug: input });
            assert.equal(result.isError, undefined);
            const payload = JSON.parse(result.content[0].text);
            assert.equal(payload.success, true);
            assert.equal(Array.isArray(payload.data), false);
            assert.equal(payload.data.slug, slug);
            assert.deepEqual(api.requests, [`/public/${resource}/${encoded}`]);
        });
    }
}

test('MCP 상세 도구 스키마는 공개 API와 같은 slug 패턴과 최대 길이를 알린다', async () => {
    let result;
    await createMessageHandler({
        writeResult: (_id, value) => { result = value; },
        writeError: (_id, code, message) => assert.fail(`${code}: ${message}`)
    })({ id: 1, method: 'tools/list' });
    for (const toolName of ['get_project', 'get_blog_post']) {
        const schema = result.tools.find(tool => tool.name === toolName).inputSchema.properties.slug;
        assert.equal(schema.minLength, 1);
        assert.equal(schema.maxLength, 255);
        assert.equal(typeof schema.pattern, 'string');
        const pattern = new RegExp(schema.pattern);
        for (const slug of ['project-1', '한글-글']) assert.equal(pattern.test(slug), true, slug);
        for (const slug of ['.', '..', '/', '%2e', 'bad slug', 'a--b', 'UPPER']) assert.equal(pattern.test(slug), false, slug);
    }
});
