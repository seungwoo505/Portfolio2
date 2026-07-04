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
    ['routes', 'admin', 'blog.ts'],
    ['routes', 'admin', 'blog', 'index.ts'],
    ['routes', 'admin', 'blog', 'common.ts'],
    ['routes', 'admin', 'blog', 'collection.ts'],
    ['routes', 'admin', 'blog', 'detail.ts'],
    ['routes', 'admin', 'blog', 'lookup.ts'],
    ['routes', 'admin', 'blog', 'payload.ts'],
    ['routes', 'admin', 'blog', 'status-update.ts'],
    ['routes', 'admin', 'blog', 'status.ts']
];

const adminProjectRouteModules = [
    ['routes', 'admin', 'projects.ts'],
    ['routes', 'admin', 'projects', 'index.ts'],
    ['routes', 'admin', 'projects', 'catalog-sections.ts'],
    ['routes', 'admin', 'projects', 'common.ts'],
    ['routes', 'admin', 'projects', 'collection.ts'],
    ['routes', 'admin', 'projects', 'detail.ts'],
    ['routes', 'admin', 'projects', 'images.ts'],
    ['routes', 'admin', 'projects', 'payload.ts'],
    ['routes', 'admin', 'projects', 'update.ts']
];

const adminProfileRouteModules = [
    ['routes', 'admin', 'profile.ts'],
    ['routes', 'admin', 'profile', 'index.ts'],
    ['routes', 'admin', 'profile', 'personal-info.ts'],
    ['routes', 'admin', 'profile', 'social-links.ts'],
    ['routes', 'admin', 'profile', 'social-links', 'index.ts'],
    ['routes', 'admin', 'profile', 'social-links', 'collection.ts'],
    ['routes', 'admin', 'profile', 'social-links', 'detail.ts'],
    ['routes', 'admin', 'profile', 'social-links', 'payload.ts']
];

const adminSettingsRouteModules = [
    ['routes', 'admin', 'settings.ts'],
    ['routes', 'admin', 'settings', 'validation.ts']
];

const adminInterestsRouteModules = [
    ['routes', 'admin', 'interests.ts'],
    ['routes', 'admin', 'interests', 'index.ts'],
    ['routes', 'admin', 'interests', 'collection.ts'],
    ['routes', 'admin', 'interests', 'detail.ts'],
    ['routes', 'admin', 'interests', 'payload.ts']
];

const adminTagsRouteModules = [
    ['routes', 'admin', 'tags.ts'],
    ['routes', 'admin', 'tags', 'index.ts'],
    ['routes', 'admin', 'tags', 'collection.ts'],
    ['routes', 'admin', 'tags', 'detail.ts'],
    ['routes', 'admin', 'tags', 'payload.ts']
];

const adminContactsRouteModules = [
    ['routes', 'admin', 'contacts.ts'],
    ['routes', 'admin', 'contacts', 'index.ts'],
    ['routes', 'admin', 'contacts', 'collection.ts'],
    ['routes', 'admin', 'contacts', 'actions.ts']
];

const adminLogsRouteModules = [
    ['routes', 'admin', 'logs.ts'],
    ['routes', 'admin', 'logs', 'index.ts'],
    ['routes', 'admin', 'logs', 'collection.ts'],
    ['routes', 'admin', 'logs', 'export-route.ts'],
    ['routes', 'admin', 'logs', 'export.ts'],
    ['routes', 'admin', 'logs', 'filters.ts'],
    ['routes', 'admin', 'logs', 'stats.ts']
];

const adminExperiencesRouteModules = [
    ['routes', 'admin', 'experiences.ts'],
    ['routes', 'admin', 'experiences', 'index.ts'],
    ['routes', 'admin', 'experiences', 'collection.ts'],
    ['routes', 'admin', 'experiences', 'detail.ts'],
    ['routes', 'admin', 'experiences', 'timeline.ts'],
    ['routes', 'admin', 'experiences', 'payload.ts']
];

const getRouteModules = (routeSegments) => {
    const routePath = routeSegments.join('/');
    if (routePath === 'routes/admin/blog.ts') {
        return adminBlogRouteModules;
    }

    if (routePath === 'routes/admin/users.ts') {
        return [
            ['routes', 'admin', 'users.ts'],
            ['routes', 'admin', 'users', 'index.ts'],
            ['routes', 'admin', 'users', 'common.ts'],
            ['routes', 'admin', 'users', 'collection.ts'],
            ['routes', 'admin', 'users', 'detail.ts'],
            ['routes', 'admin', 'users', 'lookup.ts'],
            ['routes', 'admin', 'users', 'payload.ts']
        ];
    }

    if (routePath === 'routes/admin/projects.ts') {
        return adminProjectRouteModules;
    }

    if (routePath === 'routes/admin/profile.ts') {
        return adminProfileRouteModules;
    }

    if (routePath === 'routes/admin/settings.ts') {
        return adminSettingsRouteModules;
    }

    if (routePath === 'routes/admin/interests.ts') {
        return adminInterestsRouteModules;
    }

    if (routePath === 'routes/admin/tags.ts') {
        return adminTagsRouteModules;
    }

    if (routePath === 'routes/admin/contacts.ts') {
        return adminContactsRouteModules;
    }

    if (routePath === 'routes/admin/logs.ts') {
        return adminLogsRouteModules;
    }

    if (routePath === 'routes/admin/experiences.ts') {
        return adminExperiencesRouteModules;
    }

    return [routeSegments];
};

const loadAdminRoute = (routeSegments, moduleStubs) => {
    clearRootModules([
        ...getRouteModules(routeSegments),
        ['routes', 'admin', 'common.ts'],
        ['utils', 'cache.ts'],
        ['utils', 'filter-values.js'],
        ['utils', 'request-body.js'],
        ['utils', 'route-params.js'],
        ['utils', 'slug.js'],
        ['middleware', 'auth.ts'],
        ['log.ts'],
        ...moduleStubs.map(({ segments }) => segments)
    ]);

    stubRootModule(['routes', 'admin', 'common.ts'], {
        logger: createNoopLogger(),
        verboseDebug: () => {},
        buildErrorLog: (error) => ({ error: error.message })
    });
    stubRootModule(['utils', 'cache.ts'], { invalidateResources: () => 0 });
    stubRootModule(['middleware', 'auth.ts'], {
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
