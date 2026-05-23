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

const checkRouteModelMethods = () => {
    const routeFiles = collectJsFiles('routes');
    const requirePattern = /const\s+([A-Z][A-Za-z0-9_]*)\s*=\s*require\(['"]\.\.\/\.\.\/models\/([^'"]+)['"]\)/g;
    const methodCallPattern = /\b([A-Z][A-Za-z0-9_]*)\.([A-Za-z_][A-Za-z0-9_]*)\s*\(/g;
    const failures = [];

    for (const routeFile of routeFiles) {
        const content = fs.readFileSync(path.join(rootDir, routeFile), 'utf8');
        const modelAliases = new Map();

        for (const match of content.matchAll(requirePattern)) {
            modelAliases.set(match[1], match[2]);
        }

        for (const match of content.matchAll(methodCallPattern)) {
            const [, alias, methodName] = match;
            if (!modelAliases.has(alias)) {
                continue;
            }

            const modelPath = path.join(rootDir, 'models', modelAliases.get(alias));
            const model = require(modelPath);
            if (typeof model[methodName] !== 'function') {
                failures.push(`${routeFile}: ${alias}.${methodName}() is not exported by models/${modelAliases.get(alias)}.js`);
            }
        }
    }

    if (failures.length > 0) {
        throw new Error(`route model method check failed:\n${failures.join('\n')}`);
    }
};

for (const file of syntaxCheckFiles) {
    run(['-c', file], `syntax check ${file}`);
}

run(['-e', "require('./routes/admin'); console.log('admin routes import ok')"], 'admin route import');
checkRouteModelMethods();

console.log(`server check passed (${syntaxCheckFiles.length} files)`);
