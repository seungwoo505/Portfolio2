const {
    clearRootModules,
    createNoopLogger,
    resolveFromRoot,
    stubRootModule
} = require('./module-loader');
const { createCacheStub } = require('./cache-stub');

const publicRouteModules = [
    ['routes', 'public.ts'],
    ['routes', 'public', 'index.ts'],
    ['routes', 'public', 'common.ts'],
    ['routes', 'public', 'common', 'cache.ts'],
    ['routes', 'public', 'common', 'config.ts'],
    ['routes', 'public', 'common', 'contact.ts'],
    ['routes', 'public', 'common', 'filters.ts'],
    ['routes', 'public', 'common', 'index.ts'],
    ['routes', 'public', 'common', 'resources.ts'],
    ['routes', 'public', 'common', 'responses.ts'],
    ['routes', 'public', 'common', 'views.ts'],
    ['routes', 'public', 'profile.ts'],
    ['routes', 'public', 'contact.ts'],
    ['routes', 'public', 'skills.ts'],
    ['routes', 'public', 'projects.ts'],
    ['routes', 'public', 'posts.ts'],
    ['routes', 'public', 'tags.ts'],
    ['routes', 'public', 'experiences.ts'],
    ['routes', 'public', 'interests.ts']
];

const modelModules = [
    ['models', 'personal-info.js'],
    ['models', 'social-links.js'],
    ['models', 'skills.js'],
    ['models', 'projects.js'],
    ['models', 'blog-posts.js'],
    ['models', 'tags.js'],
    ['models', 'contact-messages.js'],
    ['models', 'experiences.js'],
    ['models', 'interests.js'],
    ['models', 'site-settings.js']
];

const loadPublicRoute = ({
    PersonalInfo = {},
    SocialLinks = {},
    Skills = {},
    Projects = {},
    BlogPosts = {},
    Tags = {},
    ContactMessages = {},
    Experiences = {},
    Interests = {},
    SiteSettings = {},
    CacheUtils = createCacheStub()
} = {}) => {
    clearRootModules([
        ...publicRouteModules,
        ...modelModules,
        ['utils', 'cache.ts'],
        ['utils', 'slug.js'],
        ['log.ts']
    ]);

    stubRootModule(['log.ts'], createNoopLogger());
    stubRootModule(['models', 'personal-info.js'], PersonalInfo);
    stubRootModule(['models', 'social-links.js'], SocialLinks);
    stubRootModule(['models', 'skills.js'], Skills);
    stubRootModule(['models', 'projects.js'], Projects);
    stubRootModule(['models', 'blog-posts.js'], BlogPosts);
    stubRootModule(['models', 'tags.js'], Tags);
    stubRootModule(['models', 'contact-messages.js'], ContactMessages);
    stubRootModule(['models', 'experiences.js'], Experiences);
    stubRootModule(['models', 'interests.js'], Interests);
    stubRootModule(['models', 'site-settings.js'], SiteSettings);
    stubRootModule(['utils', 'cache.ts'], CacheUtils);

    return require(resolveFromRoot(['routes', 'public.ts']));
};

module.exports = {
    loadPublicRoute
};
