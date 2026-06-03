const { spawnSync } = require('child_process');

const { rootDir } = require('./context');

const run = (args, label, options = {}) => {
    const stdio = options.stdio || 'inherit';
    const result = spawnSync(process.execPath, args, {
        cwd: rootDir,
        stdio,
        encoding: stdio === 'pipe' ? 'utf8' : undefined,
        env: {
            ...process.env,
            ...(options.env || {})
        },
        timeout: options.timeout
    });

    if (result.status !== 0) {
        if (stdio === 'pipe') {
            if (result.stdout) {
                process.stdout.write(result.stdout);
            }
            if (result.stderr) {
                process.stderr.write(result.stderr);
            }
        }
        if (result.error) {
            throw result.error;
        }
        throw new Error(`${label} failed`);
    }
};

module.exports = {
    run
};
