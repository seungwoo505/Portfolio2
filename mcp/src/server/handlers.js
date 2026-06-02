const {
    apiGet,
    normalizeListArgs,
    pickDefined,
    requireString
} = require('./api');
const { tools } = require('./tools');

const MCP_PROTOCOL_VERSION = '2024-11-05';

const toolHandlers = {
    get_profile: async () => apiGet('/public/profile'),
    list_projects: async (args) => apiGet('/public/projects', normalizeListArgs(args, ['tags', 'skills'])),
    get_project: async (args) => apiGet(`/public/projects/${encodeURIComponent(requireString(args, 'slug'))}`),
    list_blog_posts: async (args) => apiGet('/public/posts', normalizeListArgs(args, ['tags'])),
    get_blog_post: async (args) => apiGet(`/public/posts/${encodeURIComponent(requireString(args, 'slug'))}`),
    list_skills: async (args) => apiGet(args.featured ? '/public/skills/featured' : '/public/skills'),
    list_experiences: async (args) => {
        if (args.timeline) {
            return apiGet('/public/experiences/timeline');
        }
        return apiGet('/public/experiences', pickDefined({ type: args.type }));
    },
    list_interests: async (args) => apiGet('/public/interests', pickDefined({ category: args.category }))
};

function createMessageHandler({ writeResult, writeError }) {
    return async function handleMessage(message) {
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
    };
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

module.exports = {
    createMessageHandler
};
