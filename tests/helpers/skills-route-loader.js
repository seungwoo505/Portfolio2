const {
    clearRootModules,
    createNoopLogger,
    resolveFromRoot,
    stubRootModule
} = require('./module-loader');
const { requestJson } = require('./admin-route-loader');

const loadSkillsRoute = (Skills) => {
    clearRootModules([
        ['routes', 'admin', 'skills.ts'],
        ['routes', 'admin', 'skills', 'index.ts'],
        ['routes', 'admin', 'skills', 'common.ts'],
        ['routes', 'admin', 'skills', 'payload.ts'],
        ['routes', 'admin', 'skills', 'display-order.ts'],
        ['routes', 'admin', 'skills', 'categories.ts'],
        ['routes', 'admin', 'skills', 'crud.ts'],
        ['routes', 'admin', 'skills', 'collection.ts'],
        ['routes', 'admin', 'skills', 'detail.ts'],
        ['routes', 'admin', 'skills', 'actions.ts'],
        ['routes', 'admin', 'common.ts'],
        ['models', 'skills.ts'],
        ['utils', 'cache.ts'],
        ['utils', 'filter-values.js'],
        ['utils', 'request-body.js'],
        ['middleware', 'auth.ts'],
        ['log.ts']
    ]);

    stubRootModule(['routes', 'admin', 'common.ts'], {
        logger: createNoopLogger(),
        buildErrorLog: (error) => ({ error: error.message })
    });
    stubRootModule(['models', 'skills.ts'], Skills);
    stubRootModule(['utils', 'cache.ts'], { invalidateResources: () => 0 });
    stubRootModule(['middleware', 'auth.ts'], {
        authenticateToken: (req, _res, next) => {
            req.admin = { id: 1, role: 'super_admin' };
            next();
        },
        requirePermission: () => (_req, _res, next) => next(),
        logActivity: () => (_req, _res, next) => next()
    });

    return require(resolveFromRoot(['routes', 'admin', 'skills.ts']));
};

module.exports = {
    loadSkillsRoute,
    requestJson
};
