let inputBuffer = Buffer.alloc(0);

function startReading(handleMessage) {
    process.stdin.on('data', (chunk) => {
        inputBuffer = Buffer.concat([inputBuffer, chunk]);
        readMessages(handleMessage);
    });

    process.stdin.on('error', (error) => {
        console.error(`[portfolio-mcp] stdin error: ${error.message}`);
    });
}

function readMessages(handleMessage) {
    while (true) {
        const headerEnd = inputBuffer.indexOf('\r\n\r\n');
        if (headerEnd === -1) {
            return;
        }

        const header = inputBuffer.subarray(0, headerEnd).toString('utf8');
        const contentLengthMatch = /content-length:\s*(\d+)/i.exec(header);
        if (!contentLengthMatch) {
            inputBuffer = Buffer.alloc(0);
            writeError(null, -32600, 'Missing Content-Length header');
            return;
        }

        const contentLength = Number(contentLengthMatch[1]);
        const bodyStart = headerEnd + 4;
        const bodyEnd = bodyStart + contentLength;
        if (inputBuffer.length < bodyEnd) {
            return;
        }

        const body = inputBuffer.subarray(bodyStart, bodyEnd).toString('utf8');
        inputBuffer = inputBuffer.subarray(bodyEnd);

        let message;
        try {
            message = JSON.parse(body);
        } catch (error) {
            writeError(null, -32700, `Invalid JSON: ${error.message}`);
            continue;
        }

        handleMessage(message).catch((error) => {
            if (message.id !== undefined) {
                writeError(message.id, -32603, error.message);
            } else {
                console.error(`[portfolio-mcp] ${error.stack || error.message}`);
            }
        });
    }
}

function writeResult(id, result) {
    writeMessage({
        jsonrpc: '2.0',
        id,
        result
    });
}

function writeError(id, code, message) {
    writeMessage({
        jsonrpc: '2.0',
        id,
        error: {
            code,
            message
        }
    });
}

function writeMessage(message) {
    const body = JSON.stringify(message);
    process.stdout.write(`Content-Length: ${Buffer.byteLength(body, 'utf8')}\r\n\r\n${body}`);
}

module.exports = {
    startReading,
    writeError,
    writeResult
};
