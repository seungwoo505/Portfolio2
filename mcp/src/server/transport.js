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
        const lineEnd = inputBuffer.indexOf('\n');
        if (lineEnd === -1) {
            return;
        }

        const body = inputBuffer.subarray(0, lineEnd).toString('utf8');
        inputBuffer = inputBuffer.subarray(lineEnd + 1);

        let message;
        try {
            message = JSON.parse(body);
        } catch (error) {
            writeError(null, -32700, `Invalid JSON: ${error.message}`);
            continue;
        }

        if (message === null || typeof message !== 'object' || Array.isArray(message)) {
            writeError(null, -32600, 'Invalid Request');
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
    process.stdout.write(`${JSON.stringify(message)}\n`);
}

module.exports = {
    startReading,
    writeError,
    writeResult
};
