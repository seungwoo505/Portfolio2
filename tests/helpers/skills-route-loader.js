const {
    clearRootModules,
    createNoopLogger,
    resolveFromRoot,
    stubRootModule
} = require('./module-loader');
const { requestJson } = require('./admin-route-loader');

const loadSkillsRoute = (Skills) => {
    clearRootModules([
        ['routes', 'admin', 'skills.js'],
        ['routes', 'admin', 'skills', 'index.js'],
        ['routes', 'admin', 'skills', 'common.js'],
        ['routes', 'admin', 'skills', 'payload.js'],
        ['routes', 'admin', 'skills', 'display-order.js'],
        ['routes', 'admin', 'skills', 'categories.js'],
        ['routes', 'admin', 'skills', 'crud.js'],
        ['routes', 'admin', 'skills', 'collection.js'],
        ['routes', 'admin', 'skills', 'detail.js'],
        ['routes', 'admin', 'skills', 'actions.js'],
        ['routes', 'admin', 'common.js'],
        ['models', 'skills.js'],
        ['utils', 'cache.js'],
        ['utils', 'filter-values.js'],
        ['utils', 'request-body.js'],
        ['middleware', 'auth.js'],
        ['log.js']
    ]);

    stubRootModule(['routes', 'admin', 'common.js'], {
        logger: createNoopLogger(),
        buildErrorLog: (error) => ({ error: error.message })
    });
    stubRootModule(['models', 'skills.js'], Skills);
    stubRootModule(['utils', 'cache.js'], { invalidateResources: () => 0 });
    stubRootModule(['middleware', 'auth.js'], {
        authenticateToken: (req, _res, next) => {
            req.admin = { id: 1, role: 'super_admin' };
            next();
        },
        requirePermission: () => (_req, _res, next) => next(),
        logActivity: () => (_req, _res, next) => next()
    });

    return require(resolveFromRoot(['routes', 'admin', 'skills.js']));
};

module.exports = {
    loadSkillsRoute,
    requestJson
};
