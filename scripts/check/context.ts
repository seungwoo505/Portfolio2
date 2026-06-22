const fs = require('fs');
const path = require('path');

const rootDir = path.join(__dirname, '..', '..');
const sourceExtensions = new Set(['.js', '.ts']);
const jsExtensions = new Set(['.js']);

const collectFiles = (directory, extensions) => {
    const absoluteDirectory = path.join(rootDir, directory);
    if (!fs.existsSync(absoluteDirectory)) {
        return [];
    }

    return fs
        .readdirSync(absoluteDirectory, { withFileTypes: true })
        .flatMap((entry) => {
            const relativePath = path.join(directory, entry.name);
            if (entry.isDirectory()) {
                return collectFiles(relativePath, extensions);
            }
            return entry.isFile() && extensions.has(path.extname(entry.name)) ? [relativePath] : [];
        });
};

const collectSourceFiles = (directory) => collectFiles(directory, sourceExtensions);
const collectJsFiles = (directory) => collectFiles(directory, jsExtensions);

const rootSourceFiles = [
    'server.ts',
    'app.ts',
    'db.ts'
].filter((file) => fs.existsSync(path.join(rootDir, file)));

const sourceCheckFiles = Array.from(new Set([
    ...rootSourceFiles,
    ...collectSourceFiles('routes'),
    ...collectSourceFiles('models'),
    ...collectSourceFiles('utils'),
    ...collectSourceFiles('services'),
    ...collectSourceFiles('middleware'),
    ...collectSourceFiles('config'),
    ...collectSourceFiles('scripts'),
    ...collectSourceFiles('migrations'),
    ...collectSourceFiles(path.join('mcp', 'src')),
    ...collectSourceFiles(path.join('mcp', 'scripts'))
])).sort();
const syntaxCheckFiles = sourceCheckFiles.filter((file) => path.extname(file) === '.js');

module.exports = {
    collectJsFiles,
    collectSourceFiles,
    rootDir,
    sourceCheckFiles,
    syntaxCheckFiles
};
export {};
