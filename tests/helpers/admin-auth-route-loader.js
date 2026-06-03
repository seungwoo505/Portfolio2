const {
    clearRootModules,
    createNoopLogger,
    resolveFromRoot,
    stubRootModule
} = require('./module-loader');
const { requestJson } = require('./admin-route-loader');

const stubCommon = () => {
    stubRootModule(['routes', 'admin', 'common.js'], {
        logger: createNoopLogger(),
        buildErrorLog: (error) => ({ error: error.message })
    });
};

const stubAuthMiddleware = () => {
    stubRootModule(['middleware', 'auth.js'], {
        authenticateToken: (req, _res, next) => {
            req.admin = {
                id: 1,
                username: 'root',
                role: 'super_admin',
                sessionId: 'session-1'
            };
            next();
        },
        logActivity: () => (_req, _res, next) => next(),
        superAdminOnly: [
            (req, _res, next) => {
                req.admin = {
                    id: 1,
                    username: 'root',
                    role: 'super_admin'
                };
                next();
            }
        ]
    });
};

const adminAuthRouteModules = [
    ['routes', 'admin', 'auth.js'],
    ['routes', 'admin', 'auth', 'index.js'],
    ['routes', 'admin', 'auth', 'common.js'],
    ['routes', 'admin', 'auth', 'session.js'],
    ['routes', 'admin', 'auth', 'session', 'login.js'],
    ['routes', 'admin', 'auth', 'session', 'logout.js'],
    ['routes', 'admin', 'auth', 'session', 'refresh.js'],
    ['routes', 'admin', 'auth', 'profile.js']
];

const adminUsersRouteModules = [
    ['routes', 'admin', 'users.js'],
    ['routes', 'admin', 'users', 'index.js'],
    ['routes', 'admin', 'users', 'common.js'],
    ['routes', 'admin', 'users', 'collection.js'],
    ['routes', 'admin', 'users', 'detail.js']
];

const loadAuthRoute = ({ AdminUsers, AdminActivityLogs = { log: async () => 0 } }) => {
    clearRootModules([
        ...adminAuthRouteModules,
        ['routes', 'admin', 'common.js'],
        ['models', 'admin-users.js'],
        ['models', 'admin-activity-logs.js'],
        ['middleware', 'auth.js'],
        ['log.js']
    ]);

    stubCommon();
    stubAuthMiddleware();
    stubRootModule(['models', 'admin-users.js'], AdminUsers);
    stubRootModule(['models', 'admin-activity-logs.js'], AdminActivityLogs);

    return require(resolveFromRoot(['routes', 'admin', 'auth.js']));
};

const loadUsersRoute = (AdminUsers) => {
    clearRootModules([
        ...adminUsersRouteModules,
        ['routes', 'admin', 'common.js'],
        ['models', 'admin-users.js'],
        ['middleware', 'auth.js'],
        ['log.js']
    ]);

    stubCommon();
    stubAuthMiddleware();
    stubRootModule(['models', 'admin-users.js'], AdminUsers);

    return require(resolveFromRoot(['routes', 'admin', 'users.js']));
};

module.exports = {
    loadAuthRoute,
    loadUsersRoute,
    requestJson
};
