const {
    clearRootModules,
    createNoopLogger,
    resolveFromRoot,
    stubRootModule
} = require('./module-loader');
const { requestJson } = require('./admin-route-loader');

const stubCommon = () => {
    stubRootModule(['routes', 'admin', 'common.ts'], {
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
    ['routes', 'admin', 'users.ts'],
    ['routes', 'admin', 'users', 'index.ts'],
    ['routes', 'admin', 'users', 'common.ts'],
    ['routes', 'admin', 'users', 'collection.ts'],
    ['routes', 'admin', 'users', 'detail.ts'],
    ['routes', 'admin', 'users', 'lookup.ts'],
    ['routes', 'admin', 'users', 'payload.ts']
];

const loadAuthRoute = ({ AdminUsers, AdminActivityLogs = { log: async () => 0 } }) => {
    clearRootModules([
        ...adminAuthRouteModules,
        ['routes', 'admin', 'common.ts'],
        ['models', 'admin-users.ts'],
        ['models', 'admin-activity-logs.ts'],
        ['middleware', 'auth.ts'],
        ['log.ts']
    ]);

    stubCommon();
    stubAuthMiddleware();
    stubRootModule(['models', 'admin-users.ts'], AdminUsers);
    stubRootModule(['models', 'admin-activity-logs.ts'], AdminActivityLogs);

    return require(resolveFromRoot(['routes', 'admin', 'auth.ts']));
};

const loadUsersRoute = (AdminUsers) => {
    clearRootModules([
        ...adminUsersRouteModules,
        ['routes', 'admin', 'common.ts'],
        ['models', 'admin-users.ts'],
        ['middleware', 'auth.ts'],
        ['log.ts']
    ]);

    stubCommon();
    stubAuthMiddleware();
    stubRootModule(['models', 'admin-users.ts'], AdminUsers);

    return require(resolveFromRoot(['routes', 'admin', 'users.ts']));
};

module.exports = {
    loadAuthRoute,
    loadUsersRoute,
    requestJson
};
