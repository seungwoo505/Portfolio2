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

child.on('close', (code, signal) => {
    if (code !== 0 || responses.length !== 2 || buffer.length !== 0) {
        fail(`MCP server closed with code=${code} signal=${signal} responses=${responses.length} pendingBytes=${buffer.length} stderr=${stderr}`);
    }
    clearTimeout(timeout);
    console.log('portfolio MCP smoke test passed');
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

const timeout = setTimeout(() => {
    fail('timed out waiting for MCP responses');
}, 5000).unref();

function readMessages() {
    while (true) {
        const lineEnd = buffer.indexOf('\n');
        if (lineEnd === -1) {
            return;
        }

        const body = buffer.subarray(0, lineEnd).toString('utf8');
        buffer = buffer.subarray(lineEnd + 1);
        let response;
        try {
            response = JSON.parse(body);
        } catch (error) {
            fail(`invalid JSON line in MCP stdout: ${error.message}`);
        }
        if (response?.jsonrpc !== '2.0') {
            fail('MCP stdout included a non-JSON-RPC message');
        }
        responses.push(response);

        if (responses.length === 1) {
            if (response.id !== 1 || !response.result?.serverInfo?.name) {
                fail('initialize response is missing serverInfo');
            }
            send({ jsonrpc: '2.0', method: 'notifications/initialized' });
            send({ jsonrpc: '2.0', id: 2, method: 'tools/list', params: {} });
        } else if (responses.length === 2) {
            assertSmokeResult();
            child.stdin.end();
        } else {
            fail('MCP stdout included an unexpected response');
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
    child.stdin.write(`${JSON.stringify(message)}\n`);
}

function fail(message) {
    child.kill();
    console.error(message);
    process.exit(1);
}
