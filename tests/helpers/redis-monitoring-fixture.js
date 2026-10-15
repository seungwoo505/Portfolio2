const {
    clearRootModules,
    createNoopLogger,
    resolveFromRoot,
    stubRootModule
} = require('./module-loader');

const modulePaths = [
    ['utils', 'redis-cache.ts'],
    ['utils', 'redis-cache', 'index.ts'],
    ['utils', 'redis-cache', 'client.ts'],
    ['utils', 'redis-cache', 'commands.ts'],
    ['utils', 'redis-cache', 'connection.ts'],
    ['utils', 'redis-cache', 'stats.ts'],
    ['routes', 'monitoring.ts'],
    ['routes', 'monitoring', 'index.ts'],
    ['routes', 'monitoring', 'common.ts'],
    ['routes', 'monitoring', 'dashboard.ts'],
    ['routes', 'monitoring', 'cache.ts'],
    ['routes', 'monitoring', 'metrics.ts'],
    ['middleware', 'auth.ts'],
    ['db.ts'],
    ['log.ts']
];

const deferred = () => {
    let resolve;
    let reject;
    const promise = new Promise((resolvePromise, rejectPromise) => {
        resolve = resolvePromise;
        reject = rejectPromise;
    });
    return { promise, resolve, reject };
};

const createRedisMonitoringFixture = ({
    connect = async () => {},
    ping = async () => 'PONG',
    quit = async () => {},
    values = new Map()
} = {}) => {
    const redisModulePath = require.resolve('redis', { paths: [resolveFromRoot('package.json')] });
    const paths = [...modulePaths.map(resolveFromRoot), redisModulePath];
    const previousModules = new Map(paths.map((path) => [path, require.cache[path]]));
    clearRootModules(modulePaths);

    const calls = { connect: 0, ping: 0, get: [], flush: 0, quit: 0, destroy: 0 };
    const clients = [];
    require.cache[redisModulePath] = {
        id: redisModulePath,
        filename: redisModulePath,
        loaded: true,
        exports: {
            createClient: () => {
                const listeners = new Map();
                const client = {
                    isOpen: false,
                    isReady: false,
                    on: (event, listener) => { listeners.set(event, listener); },
                    connect: async () => {
                        calls.connect += 1;
                        if (client.isOpen) throw new Error('Socket already opened');
                        client.isOpen = true;
                        try {
                            await connect(calls.connect, client);
                            client.isReady = true;
                            listeners.get('connect')?.();
                        } catch (error) {
                            client.isOpen = false;
                            client.isReady = false;
                            throw error;
                        }
                    },
                    ping: async () => {
                        calls.ping += 1;
                        return await ping(calls.ping, client);
                    },
                    get: async (key) => {
                        calls.get.push(key);
                        return values.get(key) ?? null;
                    },
                    setEx: async (key, _ttl, value) => { values.set(key, value); return 'OK'; },
                    del: async (key) => {
                        for (const entry of Array.isArray(key) ? key : [key]) values.delete(entry);
                        return 1;
                    },
                    keys: async () => [...values.keys()],
                    flushAll: async () => { calls.flush += 1; values.clear(); return 'OK'; },
                    info: async () => 'used_memory:1',
                    dbSize: async () => values.size,
                    quit: async () => {
                        calls.quit += 1;
                        client.isOpen = false;
                        await quit();
                        client.isReady = false;
                        listeners.get('end')?.();
                    },
                    close: async () => {
                        client.isOpen = false;
                        client.isReady = false;
                        listeners.get('end')?.();
                    },
                    destroy: () => {
                        calls.destroy += 1;
                        client.isOpen = false;
                        client.isReady = false;
                        listeners.get('end')?.();
                    }
                };
                clients.push(client);
                return client;
            }
        }
    };
    stubRootModule(['log.ts'], createNoopLogger());
    stubRootModule(['middleware', 'auth.ts'], { adminOnly: [(_req, _res, next) => next()] });
    stubRootModule(['db.ts'], {
        execute: async (sql) => {
            if (sql !== 'SELECT 1 as test') throw new Error(`Unexpected SQL: ${sql}`);
            return [[{ test: 1 }], []];
        }
    });

    const redisCache = require(resolveFromRoot(['utils', 'redis-cache.ts']));
    const router = require(resolveFromRoot(['routes', 'monitoring.ts']));

    return {
        redisCache,
        router,
        calls,
        clients,
        values,
        close: async () => {
            await redisCache.disconnect();
            for (const [path, previousModule] of previousModules) {
                if (previousModule) require.cache[path] = previousModule;
                else delete require.cache[path];
            }
        }
    };
};

module.exports = { createRedisMonitoringFixture, deferred };
