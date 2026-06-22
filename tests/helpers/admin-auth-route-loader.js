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
    stubRootModule(['middleware', 'auth.ts'], {
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
    ['routes', 'admin', 'auth.ts'],
    ['routes', 'admin', 'auth', 'index.ts'],
    ['routes', 'admin', 'auth', 'common.ts'],
    ['routes', 'admin', 'auth', 'session.ts'],
    ['routes', 'admin', 'auth', 'session', 'login.ts'],
    ['routes', 'admin', 'auth', 'session', 'logout.ts'],
    ['routes', 'admin', 'auth', 'session', 'refresh.ts'],
    ['routes', 'admin', 'auth', 'profile.ts']
];

const adminUsersRouteModules = [
    ['routes', 'admin', 'users.js'],
    ['routes', 'admin', 'users', 'index.js'],
    ['routes', 'admin', 'users', 'common.js'],
    ['routes', 'admin', 'users', 'collection.js'],
    ['routes', 'admin', 'users', 'detail.js'],
    ['routes', 'admin', 'users', 'lookup.js'],
    ['routes', 'admin', 'users', 'payload.js']
];

const loadAuthRoute = ({ AdminUsers, AdminActivityLogs = { log: async () => 0 } }) => {
    clearRootModules([
        ...adminAuthRouteModules,
        ['routes', 'admin', 'common.js'],
        ['models', 'admin-users.js'],
        ['models', 'admin-activity-logs.js'],
        ['middleware', 'auth.ts'],
        ['log.ts']
    ]);

    stubCommon();
    stubAuthMiddleware();
    stubRootModule(['models', 'admin-users.js'], AdminUsers);
    stubRootModule(['models', 'admin-activity-logs.js'], AdminActivityLogs);

    return require(resolveFromRoot(['routes', 'admin', 'auth.ts']));
};

const loadUsersRoute = (AdminUsers) => {
    clearRootModules([
        ...adminUsersRouteModules,
        ['routes', 'admin', 'common.js'],
        ['models', 'admin-users.js'],
        ['middleware', 'auth.ts'],
        ['log.ts']
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
