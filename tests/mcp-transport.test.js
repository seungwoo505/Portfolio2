const test = require('node:test');
const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const { once } = require('node:events');
const path = require('node:path');

const serverPath = path.join(__dirname, '..', 'mcp', 'src', 'server.js');
const testOptions = { timeout: 5000 };

function initialize(id = 1) {
    return {
        jsonrpc: '2.0',
        id,
        method: 'initialize',
        params: {
            protocolVersion: '2024-11-05',
            capabilities: {},
            clientInfo: { name: '전송 테스트', version: '1.0.0' }
        }
    };
}

function encode(message) {
    return Buffer.from(`${JSON.stringify(message)}\n`, 'utf8');
}

function createClient(t, { observeInput = false } = {}) {
    // IPC는 서버가 첫 바이트 조각을 소비했는지 확인할 때만 사용한다.
    // 실제 서버의 stdin/stdout과 메시지 처리기는 그대로 실행한다.
    const args = observeInput ? [
        '-e',
        "require(process.argv[1]); process.stdin.on('data', () => process.send('input-read')); process.stdin.on('end', () => process.disconnect());",
        serverPath
    ] : [serverPath];
    const child = spawn(process.execPath, args, {
        stdio: observeInput ? ['pipe', 'pipe', 'pipe', 'ipc'] : ['pipe', 'pipe', 'pipe']
    });
    const closed = once(child, 'close');
    let stderr = '';
    child.stderr.setEncoding('utf8');
    child.stderr.on('data', (chunk) => { stderr += chunk; });
    t.after(async () => {
        if (child.exitCode === null && child.signalCode === null) child.kill();
        // 응답 검증이 실패해도 읽지 않은 파이프 때문에 정리가 멈추지 않게 한다.
        child.stdout.destroy();
        child.stderr.destroy();
        await closed;
    });

    const output = child.stdout[Symbol.asyncIterator]();
    let buffer = Buffer.alloc(0);

    async function readMessage() {
        while (buffer.indexOf('\n') === -1) {
            const { value, done } = await output.next();
            assert.equal(done, false, `줄바꿈 JSON-RPC 응답 없이 서버가 종료됨: ${stderr}`);
            buffer = Buffer.concat([buffer, value]);
        }
        const lineEnd = buffer.indexOf('\n');
        const line = buffer.subarray(0, lineEnd).toString('utf8');
        buffer = buffer.subarray(lineEnd + 1);
        const message = JSON.parse(line);
        assert.equal(message.jsonrpc, '2.0');
        return message;
    }

    async function expectEnd() {
        for (let next = await output.next(); !next.done; next = await output.next()) {
            buffer = Buffer.concat([buffer, next.value]);
        }
        assert.equal(buffer.length, 0, `예상 응답 외 stdout 출력: ${buffer.toString('utf8')}`);
        const [code, signal] = await closed;
        assert.equal(code, 0, `서버 종료 signal=${signal} stderr=${stderr}`);
        assert.equal(stderr, '');
    }

    return { child, readMessage, expectEnd };
}

function assertInitialized(response, id = 1) {
    assert.equal(response.id, id);
    assert.equal(response.error, undefined);
    assert.equal(response.result.protocolVersion, '2024-11-05');
    assert.equal(response.result.serverInfo.name, 'portfolio-mcp-server');
    assert.deepEqual(response.result.capabilities, { tools: {} });
}

function assertTools(response, id = 2) {
    assert.equal(response.id, id);
    assert.equal(response.error, undefined);
    assert.ok(Array.isArray(response.result.tools));
    assert.ok(response.result.tools.some((tool) => tool.name === 'get_profile'));
    assert.ok(response.result.tools.some((tool) => tool.name === 'list_projects'));
}

test('표준 stdio로 초기화 후 도구 목록을 조회하고 stdout에는 응답만 출력한다', testOptions, async (t) => {
    const client = createClient(t);
    client.child.stdin.write(encode(initialize()));
    assertInitialized(await client.readMessage());

    client.child.stdin.end(Buffer.concat([
        encode({ jsonrpc: '2.0', method: 'notifications/initialized' }),
        encode({ jsonrpc: '2.0', id: 2, method: 'tools/list', params: {} })
    ]));
    assertTools(await client.readMessage());
    await client.expectEnd();
});

test('한 번에 입력한 여러 줄의 JSON-RPC 메시지를 각각 처리한다', testOptions, async (t) => {
    const client = createClient(t);
    client.child.stdin.end(Buffer.concat([
        encode(initialize()),
        encode({ jsonrpc: '2.0', id: 2, method: 'tools/list', params: {} })
    ]));
    assertInitialized(await client.readMessage());
    assertTools(await client.readMessage());
    await client.expectEnd();
});

test('UTF-8 문자 중간과 마지막 줄바꿈이 나뉘어 도착해도 메시지를 보존한다', testOptions, async (t) => {
    const client = createClient(t, { observeInput: true });
    const id = '초기화🙂\n두 번째';
    const request = encode(initialize(id));
    const splitAt = request.indexOf(Buffer.from('초', 'utf8')) + 1;

    let consumed = once(client.child, 'message');
    client.child.stdin.write(request.subarray(0, splitAt));
    assert.equal((await consumed)[0], 'input-read');

    consumed = once(client.child, 'message');
    client.child.stdin.write(request.subarray(splitAt, request.length - 1));
    assert.equal((await consumed)[0], 'input-read');

    client.child.stdin.end(request.subarray(request.length - 1));
    assertInitialized(await client.readMessage(), id);
    await client.expectEnd();
});

test('잘못된 JSON 한 줄 뒤에도 다음 표준 메시지를 계속 처리한다', testOptions, async (t) => {
    const client = createClient(t);
    client.child.stdin.end(Buffer.concat([
        Buffer.from('{invalid-json}\n', 'utf8'),
        encode(initialize()),
        encode({ jsonrpc: '2.0', id: 2, method: 'tools/list', params: {} })
    ]));
    const error = await client.readMessage();
    assert.equal(error.id, null);
    assert.equal(error.error.code, -32700);
    assertInitialized(await client.readMessage());
    assertTools(await client.readMessage());
    await client.expectEnd();
});

test('객체가 아닌 JSON 요청을 거절한 뒤에도 다음 표준 메시지를 계속 처리한다', testOptions, async (t) => {
    const client = createClient(t);
    const invalidRequests = [null, true, 42, 'invalid request', []];
    client.child.stdin.end(Buffer.concat([
        ...invalidRequests.map(encode),
        encode(initialize()),
        encode({ jsonrpc: '2.0', id: 2, method: 'tools/list', params: {} })
    ]));
    for (const value of invalidRequests) {
        const error = await client.readMessage();
        assert.equal(error.id, null, JSON.stringify(value));
        assert.equal(error.error.code, -32600, JSON.stringify(value));
    }
    assertInitialized(await client.readMessage());
    assertTools(await client.readMessage());
    await client.expectEnd();
});
