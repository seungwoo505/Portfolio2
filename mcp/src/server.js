#!/usr/bin/env node

const DEFAULT_API_BASE_URL = 'http://localhost:3001/api';
const MCP_PROTOCOL_VERSION = '2024-11-05';

const tools = [
    {
        name: 'get_profile',
        description: 'Fetch the public portfolio profile information.',
        inputSchema: {
            type: 'object',
            additionalProperties: false,
            properties: {}
        }
    },
    {
        name: 'list_projects',
        description: 'List published portfolio projects with optional filters.',
        inputSchema: {
            type: 'object',
            additionalProperties: false,
            properties: {
                limit: { type: 'integer', minimum: 1, maximum: 50, default: 10 },
                page: { type: 'integer', minimum: 1, default: 1 },
                search: { type: 'string' },
                tags: { type: 'array', items: { type: 'string' } },
                skills: { type: 'array', items: { type: 'string' } },
                featured: { type: 'boolean' },
                sort: { type: 'string', enum: ['created_at', 'title', 'view_count', 'display_order'] },
                order: { type: 'string', enum: ['asc', 'desc'] }
            }
        }
    },
    {
        name: 'get_project',
        description: 'Fetch a published project by slug.',
        inputSchema: {
            type: 'object',
            additionalProperties: false,
            required: ['slug'],
            properties: {
                slug: { type: 'string', minLength: 1 }
            }
        }
    },
    {
        name: 'list_blog_posts',
        description: 'List published blog posts with optional filters.',
        inputSchema: {
            type: 'object',
            additionalProperties: false,
            properties: {
                limit: { type: 'integer', minimum: 1, maximum: 50, default: 10 },
                page: { type: 'integer', minimum: 1, default: 1 },
                search: { type: 'string' },
                tags: { type: 'array', items: { type: 'string' } },
                featured: { type: 'boolean' },
                sort: { type: 'string', enum: ['published_at', 'created_at', 'title', 'view_count'] },
                order: { type: 'string', enum: ['asc', 'desc'] }
            }
        }
    },
    {
        name: 'get_blog_post',
        description: 'Fetch a published blog post by slug.',
        inputSchema: {
            type: 'object',
            additionalProperties: false,
            required: ['slug'],
            properties: {
                slug: { type: 'string', minLength: 1 }
            }
        }
    },
    {
        name: 'list_skills',
        description: 'List portfolio skills and categories, or only featured skills.',
        inputSchema: {
            type: 'object',
            additionalProperties: false,
            properties: {
                featured: { type: 'boolean', default: false }
            }
        }
    },
    {
        name: 'list_experiences',
        description: 'List portfolio experiences, optionally as a timeline or by type.',
        inputSchema: {
            type: 'object',
            additionalProperties: false,
            properties: {
                type: { type: 'string' },
                timeline: { type: 'boolean', default: false }
            }
        }
    },
    {
        name: 'list_interests',
        description: 'List portfolio interests, optionally filtered by category.',
        inputSchema: {
            type: 'object',
            additionalProperties: false,
            properties: {
                category: { type: 'string' }
            }
        }
    }
];

const toolHandlers = {
    get_profile: async () => apiGet('/personal-info'),
    list_projects: async (args) => apiGet('/projects', normalizeListArgs(args, ['tags', 'skills'])),
    get_project: async (args) => apiGet(`/projects/slug/${encodeURIComponent(requireString(args, 'slug'))}`),
    list_blog_posts: async (args) => apiGet('/blog/posts', normalizeListArgs(args, ['tags'])),
    get_blog_post: async (args) => apiGet(`/blog/posts/${encodeURIComponent(requireString(args, 'slug'))}`),
    list_skills: async (args) => apiGet(args.featured ? '/skills/featured' : '/skills'),
    list_experiences: async (args) => {
        if (args.timeline) {
            return apiGet('/experiences/timeline');
        }
        return apiGet('/experiences', pickDefined({ type: args.type }));
    },
    list_interests: async (args) => apiGet('/interests', pickDefined({ category: args.category }))
};

let inputBuffer = Buffer.alloc(0);

process.stdin.on('data', (chunk) => {
    inputBuffer = Buffer.concat([inputBuffer, chunk]);
    readMessages();
});

process.stdin.on('error', (error) => {
    console.error(`[portfolio-mcp] stdin error: ${error.message}`);
});

function readMessages() {
    while (true) {
        const headerEnd = inputBuffer.indexOf('\r\n\r\n');
        if (headerEnd === -1) {
            return;
        }

        const header = inputBuffer.subarray(0, headerEnd).toString('utf8');
        const contentLengthMatch = /content-length:\s*(\d+)/i.exec(header);
        if (!contentLengthMatch) {
            inputBuffer = Buffer.alloc(0);
            writeError(null, -32600, 'Missing Content-Length header');
            return;
        }

        const contentLength = Number(contentLengthMatch[1]);
        const bodyStart = headerEnd + 4;
        const bodyEnd = bodyStart + contentLength;
        if (inputBuffer.length < bodyEnd) {
            return;
        }

        const body = inputBuffer.subarray(bodyStart, bodyEnd).toString('utf8');
        inputBuffer = inputBuffer.subarray(bodyEnd);

        let message;
        try {
            message = JSON.parse(body);
        } catch (error) {
            writeError(null, -32700, `Invalid JSON: ${error.message}`);
            continue;
        }

        handleMessage(message).catch((error) => {
            if (message.id !== undefined) {
                writeError(message.id, -32603, error.message);
            } else {
                console.error(`[portfolio-mcp] ${error.stack || error.message}`);
            }
        });
    }
}

async function handleMessage(message) {
    const { id, method, params = {} } = message;
    const isNotification = id === undefined || id === null;

    if (!method) {
        if (!isNotification) {
            writeError(id, -32600, 'Missing method');
        }
        return;
    }

    if (method.startsWith('notifications/')) {
        return;
    }

    if (method === 'initialize') {
        writeResult(id, {
            protocolVersion: params.protocolVersion || MCP_PROTOCOL_VERSION,
            capabilities: {
                tools: {}
            },
            serverInfo: {
                name: 'portfolio-mcp-server',
                version: '1.0.0'
            }
        });
        return;
    }

    if (method === 'ping') {
        writeResult(id, {});
        return;
    }

    if (method === 'tools/list') {
        writeResult(id, { tools });
        return;
    }

    if (method === 'tools/call') {
        const toolName = params.name;
        const handler = toolHandlers[toolName];
        if (!handler) {
            writeResult(id, toolErrorContent(`Unknown tool: ${toolName}`));
            return;
        }

        try {
            const result = await handler(params.arguments || {});
            writeResult(id, {
                content: [
                    {
                        type: 'text',
                        text: JSON.stringify(result, null, 2)
                    }
                ]
            });
        } catch (error) {
            writeResult(id, toolErrorContent(error.message));
        }
        return;
    }

    writeError(id, -32601, `Method not found: ${method}`);
}

async function apiGet(path, query = {}) {
    if (typeof fetch !== 'function') {
        throw new Error('Node.js 18 이상이 필요합니다. 현재 런타임에는 fetch가 없습니다.');
    }

    const apiBaseUrl = (process.env.PORTFOLIO_API_BASE_URL || DEFAULT_API_BASE_URL).replace(/\/+$/, '');
    const url = new URL(`${apiBaseUrl}${path}`);

    Object.entries(query).forEach(([key, value]) => {
        if (value !== undefined && value !== null && value !== '') {
            url.searchParams.set(key, String(value));
        }
    });

    const response = await fetch(url, {
        headers: {
            accept: 'application/json'
        }
    });
    const payload = await response.json().catch(() => null);

    if (!response.ok) {
        const message = payload?.message || payload?.error || `${response.status} ${response.statusText}`;
        throw new Error(`Portfolio API request failed: ${message}`);
    }

    if (payload && payload.success === false) {
        throw new Error(payload.message || payload.error || 'Portfolio API returned success=false');
    }

    return payload;
}

function normalizeListArgs(args = {}, arrayFields = []) {
    const query = pickDefined({
        limit: clampInteger(args.limit, 1, 50),
        page: clampInteger(args.page, 1, Number.MAX_SAFE_INTEGER),
        search: args.search,
        featured: typeof args.featured === 'boolean' ? args.featured : undefined,
        sort: args.sort,
        order: args.order
    });

    arrayFields.forEach((field) => {
        if (Array.isArray(args[field]) && args[field].length > 0) {
            query[field] = args[field].map((value) => String(value).trim()).filter(Boolean).join(',');
        }
    });

    return query;
}

function pickDefined(object) {
    return Object.fromEntries(
        Object.entries(object).filter(([, value]) => value !== undefined && value !== null && value !== '')
    );
}

function clampInteger(value, min, max) {
    if (value === undefined || value === null) {
        return undefined;
    }
    const parsed = Number.parseInt(value, 10);
    if (!Number.isFinite(parsed)) {
        return undefined;
    }
    return Math.min(Math.max(parsed, min), max);
}

function requireString(args, key) {
    const value = args?.[key];
    if (typeof value !== 'string' || value.trim() === '') {
        throw new Error(`${key} is required`);
    }
    return value.trim();
}

function toolErrorContent(message) {
    return {
        isError: true,
        content: [
            {
                type: 'text',
                text: message
            }
        ]
    };
}

function writeResult(id, result) {
    writeMessage({
        jsonrpc: '2.0',
        id,
        result
    });
}

function writeError(id, code, message) {
    writeMessage({
        jsonrpc: '2.0',
        id,
        error: {
            code,
            message
        }
    });
}

function writeMessage(message) {
    const body = JSON.stringify(message);
    process.stdout.write(`Content-Length: ${Buffer.byteLength(body, 'utf8')}\r\n\r\n${body}`);
}
