const fs = require('fs');
const path = require('path');

const rootDir = path.join(__dirname, '..', '..');

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
    'app.js',
    'log.js',
    'db.js',
    ...collectJsFiles('routes'),
    ...collectJsFiles('models'),
    ...collectJsFiles('utils'),
    ...collectJsFiles('services'),
    ...collectJsFiles('middleware'),
    ...collectJsFiles('config'),
    ...collectJsFiles('scripts'),
    ...collectJsFiles('migrations'),
    ...collectJsFiles(path.join('mcp', 'src')),
    ...collectJsFiles(path.join('mcp', 'scripts'))
])).sort();

module.exports = {
    collectJsFiles,
    rootDir,
    syntaxCheckFiles
};
