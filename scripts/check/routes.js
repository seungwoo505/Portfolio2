const fs = require('fs');
const path = require('path');

const { collectJsFiles, rootDir } = require('./context');

const checkAdminRouteExport = () => {
    const adminRoutes = require(path.join(rootDir, 'routes', 'admin'));
    if (typeof adminRoutes !== 'function') {
        throw new Error('routes/admin must export an Express router function');
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

module.exports = {
    checkAdminRouteExport,
    checkRouteModelMethods
};
