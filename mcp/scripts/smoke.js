const { spawn } = require('child_process');
const path = require('path');

const serverPath = path.join(__dirname, '..', 'src', 'server.js');
const child = spawn(process.execPath, [serverPath], {
    stdio: ['pipe', 'pipe', 'pipe']
});

let buffer = Buffer.alloc(0);
const responses = [];
let stderr = '';

child.stdout.on('data', (chunk) => {
    buffer = Buffer.concat([buffer, chunk]);
    readMessages();
});

child.stderr.on('data', (chunk) => {
    stderr += chunk.toString('utf8');
});

child.on('error', (error) => {
    fail(`failed to start MCP server: ${error.message}`);
});

child.on('exit', (code, signal) => {
    if (responses.length < 2) {
        fail(`MCP server exited early with code=${code} signal=${signal} stderr=${stderr}`);
    }
});

send({
    jsonrpc: '2.0',
    id: 1,
    method: 'initialize',
    params: {
        protocolVersion: '2024-11-05',
        capabilities: {},
        clientInfo: {
            name: 'portfolio-mcp-smoke',
            version: '1.0.0'
        }
    }
});

send({
    jsonrpc: '2.0',
    id: 2,
    method: 'tools/list',
    params: {}
});

setTimeout(() => {
    fail('timed out waiting for MCP responses');
}, 5000).unref();

function readMessages() {
    while (true) {
        const headerEnd = buffer.indexOf('\r\n\r\n');
        if (headerEnd === -1) {
            return;
        }

        const header = buffer.subarray(0, headerEnd).toString('utf8');
        const match = /content-length:\s*(\d+)/i.exec(header);
        if (!match) {
            fail('missing Content-Length in response');
        }

        const bodyStart = headerEnd + 4;
        const bodyEnd = bodyStart + Number(match[1]);
        if (buffer.length < bodyEnd) {
            return;
        }

        const body = buffer.subarray(bodyStart, bodyEnd).toString('utf8');
        buffer = buffer.subarray(bodyEnd);
        responses.push(JSON.parse(body));

        if (responses.length === 2) {
            assertSmokeResult();
            child.kill();
            console.log('portfolio MCP smoke test passed');
        }
    }
}

function assertSmokeResult() {
    const initialize = responses.find((response) => response.id === 1);
    const tools = responses.find((response) => response.id === 2);

    if (!initialize?.result?.serverInfo?.name) {
        fail('initialize response is missing serverInfo');
    }

    if (!Array.isArray(tools?.result?.tools) || tools.result.tools.length < 8) {
        fail('tools/list response did not include the expected tools');
    }
}

function send(message) {
    const body = JSON.stringify(message);
    child.stdin.write(`Content-Length: ${Buffer.byteLength(body, 'utf8')}\r\n\r\n${body}`);
}

function fail(message) {
    child.kill();
    console.error(message);
    process.exit(1);
}
