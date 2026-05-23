#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const rootDir = path.join(__dirname, '..');

const collectJsFiles = (directory) => {
    const absoluteDirectory = path.join(rootDir, directory);
    if (!fs.existsSync(absoluteDirectory)) {
        return [];
    }

    return fs
        .readdirSync(absoluteDirectory, { withFileTypes: true })
        .flatMap((entry) => {
            const relativePath = path.join(directory, entry.name);
            if (entry.isDirectory()) {
                return collectJsFiles(relativePath);
            }
            return entry.isFile() && entry.name.endsWith('.js') ? [relativePath] : [];
        });
};

const syntaxCheckFiles = Array.from(new Set([
    'server.js',
    'log.js',
    'db.js',
    ...collectJsFiles('routes'),
    ...collectJsFiles('models'),
    ...collectJsFiles('utils'),
    ...collectJsFiles('services'),
    ...collectJsFiles('middleware'),
    ...collectJsFiles('scripts'),
    ...collectJsFiles('migrations'),
    ...collectJsFiles(path.join('mcp', 'src')),
    ...collectJsFiles(path.join('mcp', 'scripts'))
])).sort();

const run = (args, label) => {
    const result = spawnSync(process.execPath, args, {
        cwd: rootDir,
        stdio: 'inherit'
    });

    if (result.status !== 0) {
        throw new Error(`${label} failed`);
    }
};

for (const file of syntaxCheckFiles) {
    run(['-c', file], `syntax check ${file}`);
}

run(['-e', "require('./routes/admin'); console.log('admin routes import ok')"], 'admin route import');

console.log(`server check passed (${syntaxCheckFiles.length} files)`);
