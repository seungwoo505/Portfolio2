const path = require('node:path');

const rootDir = path.join(__dirname, '..', '..');

const toSegments = (segments) => (Array.isArray(segments) ? segments : [segments]);

const resolveFromRoot = (segments) => require.resolve(path.join(rootDir, ...toSegments(segments)));

const clearRootModule = (segments) => {
    const resolved = resolveFromRoot(segments);
    delete require.cache[resolved];
    return resolved;
};

const clearRootModules = (modulePaths) => {
    modulePaths.forEach(clearRootModule);
};

const stubRootModule = (segments, exports) => {
    const resolved = resolveFromRoot(segments);
    require.cache[resolved] = {
        id: resolved,
        filename: resolved,
        loaded: true,
        exports
    };
    return resolved;
};

const createNoopLogger = () => new Proxy({}, {
    get: () => () => {}
});

module.exports = {
    rootDir,
    resolveFromRoot,
    clearRootModule,
    clearRootModules,
    stubRootModule,
    createNoopLogger
};
