const express = require('express');
const {
    clearRootModules,
    createNoopLogger,
    resolveFromRoot,
    stubRootModule
} = require('./module-loader');

const requestJson = async (router, path, { method = 'GET', body = null } = {}) => {
    const app = express();
    app.use(express.json());
    app.use(router);

    const server = await new Promise((resolve) => {
        const activeServer = app.listen(0, '127.0.0.1', () => resolve(activeServer));
    });

    try {
        const { port } = server.address();
        const response = await fetch(`http://127.0.0.1:${port}${path}`, {
            method,
            headers: body ? { 'Content-Type': 'application/json' } : undefined,
            body: body ? JSON.stringify(body) : undefined
        });
        return {
            status: response.status,
            body: await response.json()
        };
    } finally {
        await new Promise((resolve, reject) => {
            server.close((error) => (error ? reject(error) : resolve()));
        });
    }
};

const adminBlogRouteModules = [
    ['routes', 'admin', 'blog.js'],
    ['routes', 'admin', 'blog', 'index.js'],
    ['routes', 'admin', 'blog', 'common.js'],
    ['routes', 'admin', 'blog', 'collection.js'],
    ['routes', 'admin', 'blog', 'detail.js'],
    ['routes', 'admin', 'blog', 'status.js']
];

const adminProjectRouteModules = [
    ['routes', 'admin', 'projects.js'],
    ['routes', 'admin', 'projects', 'index.js'],
    ['routes', 'admin', 'projects', 'common.js'],
    ['routes', 'admin', 'projects', 'collection.js'],
    ['routes', 'admin', 'projects', 'detail.js'],
    ['routes', 'admin', 'projects', 'payload.js'],
    ['routes', 'admin', 'projects', 'update.js']
];

const adminProfileRouteModules = [
    ['routes', 'admin', 'profile.js'],
    ['routes', 'admin', 'profile', 'index.js'],
    ['routes', 'admin', 'profile', 'personal-info.js'],
    ['routes', 'admin', 'profile', 'social-links.js']
];

const adminSettingsRouteModules = [
    ['routes', 'admin', 'settings.js'],
    ['routes', 'admin', 'settings', 'validation.js']
];

const getRouteModules = (routeSegments) => {
    const routePath = routeSegments.join('/');
    if (routePath === 'routes/admin/blog.js') {
        return adminBlogRouteModules;
    }

    if (routePath === 'routes/admin/projects.js') {
        return adminProjectRouteModules;
    }

    if (routePath === 'routes/admin/profile.js') {
        return adminProfileRouteModules;
    }

    if (routePath === 'routes/admin/settings.js') {
        return adminSettingsRouteModules;
    }

    return [routeSegments];
};

const loadAdminRoute = (routeSegments, moduleStubs) => {
    clearRootModules([
        ...getRouteModules(routeSegments),
        ['routes', 'admin', 'common.js'],
        ['utils', 'cache.js'],
        ['utils', 'filter-values.js'],
        ['utils', 'request-body.js'],
        ['utils', 'route-params.js'],
        ['utils', 'slug.js'],
        ['middleware', 'auth.js'],
        ['log.js'],
        ...moduleStubs.map(({ segments }) => segments)
    ]);

    stubRootModule(['routes', 'admin', 'common.js'], {
        logger: createNoopLogger(),
        verboseDebug: () => {},
        buildErrorLog: (error) => ({ error: error.message })
    });
    stubRootModule(['utils', 'cache.js'], { invalidateResources: () => 0 });
    stubRootModule(['middleware', 'auth.js'], {
        authenticateToken: (req, _res, next) => {
            req.admin = { id: 1, role: 'super_admin' };
            next();
        },
        requirePermission: () => (_req, _res, next) => next(),
        logActivity: () => (_req, _res, next) => next()
    });

    moduleStubs.forEach(({ segments, moduleExports }) => {
        stubRootModule(segments, moduleExports);
    });

    return require(resolveFromRoot(routeSegments));
};

module.exports = {
    loadAdminRoute,
    requestJson
};
