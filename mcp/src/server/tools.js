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

module.exports = {
    tools
};
