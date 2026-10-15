const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { Writable } = require('node:stream');
const { setImmediate: nextTurn } = require('node:timers/promises');

const mode = process.argv[2];
const errorCode = process.argv[3] || 'ENOSPC';
const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'portfolio-logger-errors-'));
const root = path.resolve(__dirname, '..', '..');
const runtimeLogDirectory = path.join(root, 'logs');
const output = [];
const createWriteStream = fs.createWriteStream;
const mkdir = fs.promises.mkdir;
const rotator = require('file-stream-rotator');
const getStream = rotator.getStream;
const failure = () => Object.assign(new Error(`log storage ${errorCode}`), { code: errorCode });

fs.promises.mkdir = async (target, options) => {
    if (target !== runtimeLogDirectory) return await mkdir.call(fs.promises, target, options);
    if (mode === 'initialization-error') throw failure();
};
fs.createWriteStream = (filename, options) => {
    if (path.dirname(filename) !== directory) return createWriteStream.call(fs, filename, options);
    return new Writable({
        write(chunk, _encoding, callback) {
            output.push(chunk.toString());
            callback(mode === 'write-error' || mode === 'console-error' ? failure() : null);
        }
    });
};
rotator.getStream = (options) => {
    if (mode === 'initialization-error') throw failure();
    return getStream.call(rotator, {
        ...options,
        filename: path.join(directory, '%DATE%.log'),
        audit_file: path.join(directory, 'audit.json')
    });
};

(async () => {
    try {
        if (mode === 'console-error') console.error = () => { throw new Error('console unavailable'); };
        const logger = require(path.join(root, 'log.ts'));
        logger.info('file-and-console', { requestId: 'req-file' });
        if (mode === 'transport-error') {
            const { transport } = require(path.join(root, 'logger', 'runtime.ts'));
            transport.emit('error', failure());
        }
        if (mode === 'logger-error') logger.emit('error', failure());
        await nextTurn();
        logger.info('console-after-error', { requestId: 'req-after' });
        await nextTurn();
        logger.close();
        await nextTurn();
        process.stdout.write(`LOGGER_RESULT:${JSON.stringify({ survived: true, output: output.join('') })}\n`);
    } finally {
        const absoluteDirectory = path.resolve(directory);
        if (path.dirname(absoluteDirectory) !== path.resolve(os.tmpdir())) {
            throw new Error('Temporary log directory is outside the expected parent');
        }
        fs.rmSync(absoluteDirectory, { recursive: true, force: true });
    }
})().catch((error) => {
    process.stderr.write(`${error.stack}\n`);
    process.exitCode = 1;
});
