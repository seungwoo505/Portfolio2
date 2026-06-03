const express = require('express');

const createApp = (router, { json = false } = {}) => {
    const app = express();
    if (json) {
        app.use(express.json({ strict: false }));
    }
    app.use(router);
    return app;
};

const startRouterServer = async (router, options = {}) => {
    const app = createApp(router, options);

    const server = await new Promise((resolve) => {
        const activeServer = app.listen(0, '127.0.0.1', () => resolve(activeServer));
    });

    return {
        baseUrl: `http://127.0.0.1:${server.address().port}`,
        close: () => new Promise((resolve, reject) => {
            server.close((error) => (error ? reject(error) : resolve()));
        })
    };
};

const readJsonResponse = async (response) => ({
    status: response.status,
    body: await response.json()
});

const requestJson = async (router, path, { method = 'GET', body = undefined, json = body !== undefined } = {}) => {
    const server = await startRouterServer(router, { json });

    try {
        const hasBody = body !== undefined;
        const response = await fetch(`${server.baseUrl}${path}`, {
            method,
            headers: hasBody ? { 'Content-Type': 'application/json' } : undefined,
            body: hasBody ? JSON.stringify(body) : undefined
        });
        return await readJsonResponse(response);
    } finally {
        await server.close();
    }
};

const postJson = async (baseUrl, path, body) => {
    const response = await fetch(`${baseUrl}${path}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
    });

    return await readJsonResponse(response);
};

const waitFor = async (predicate, timeoutMs = 500) => {
    const startedAt = Date.now();

    while (!predicate()) {
        if (Date.now() - startedAt > timeoutMs) {
            throw new Error('condition was not met in time');
        }
        await new Promise((resolve) => setTimeout(resolve, 5));
    }
};

module.exports = {
    postJson,
    readJsonResponse,
    requestJson,
    startRouterServer,
    waitFor
};
