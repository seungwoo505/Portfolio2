const test = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');

const {
    clearRootModules,
    resolveFromRoot,
    stubRootModule
} = require('./helpers/module-loader');

const requestJson = async (router, path, { method = 'GET' } = {}) => {
    const app = express();
    app.use(router);

    const server = await new Promise((resolve) => {
        const activeServer = app.listen(0, '127.0.0.1', () => resolve(activeServer));
    });

    try {
        const { port } = server.address();
        const response = await fetch(`http://127.0.0.1:${port}${path}`, { method });
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

const loadDashboardRoute = ({ executeQuery, contactStats, activityStats, activityDays }) => {
    const requiredPermissions = [];

    clearRootModules([
        ['routes', 'admin', 'dashboard.js'],
        ['models', 'admin-activity-logs.js'],
        ['models', 'contact-messages.js'],
        ['models', 'db-utils.js'],
        ['middleware', 'auth.js']
    ]);

    stubRootModule(['models', 'admin-activity-logs.js'], {
        getStats: async (days) => {
            activityDays.push(days);
            return activityStats;
        }
    });
    stubRootModule(['models', 'contact-messages.js'], {
        getStats: async () => contactStats
    });
    stubRootModule(['models', 'db-utils.js'], { executeQuery });
    stubRootModule(['middleware', 'auth.js'], {
        authenticateToken: (req, _res, next) => {
            req.admin = { id: 1, role: 'super_admin' };
            next();
        },
        requirePermission: (permission) => {
            requiredPermissions.push(permission);
            return (_req, _res, next) => next();
        }
    });

    return {
        router: require(resolveFromRoot(['routes', 'admin', 'dashboard.js'])),
        requiredPermissions
    };
};

test('admin dashboard combines blog project contact and activity stats', async () => {
    const executedSql = [];
    const activityDays = [];
    const { router, requiredPermissions } = loadDashboardRoute({
        activityDays,
        contactStats: {
            total: 8,
            unread: 2
        },
        activityStats: {
            total_activities: 15
        },
        executeQuery: async (sql) => {
            executedSql.push(sql);

            if (sql.includes('FROM blog_posts')) {
                return [{ total: 12, published: 9, drafts: 3 }];
            }

            if (sql.includes('FROM projects')) {
                return [{ total: 5, featured: 2 }];
            }

            throw new Error(`unexpected dashboard query: ${sql}`);
        }
    });

    const { status, body } = await requestJson(router, '/dashboard');

    assert.equal(status, 200);
    assert.deepEqual(body, {
        success: true,
        data: {
            blog: {
                total: 12,
                published: 9,
                drafts: 3
            },
            projects: {
                total: 5,
                featured: 2
            },
            contacts: {
                total: 8,
                unread: 2
            },
            activities: {
                total_activities: 15
            }
        }
    });
    assert.equal(executedSql.length, 2);
    assert.deepEqual(activityDays, [7]);
    assert.deepEqual(requiredPermissions, ['dashboard.read']);
});
