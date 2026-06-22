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
    ['models', 'personal-info.ts'],
    ['models', 'social-links.ts'],
    ['models', 'skills.ts'],
    ['models', 'projects.ts'],
    ['models', 'blog-posts.ts'],
    ['models', 'tags.ts'],
    ['models', 'contact-messages.ts'],
    ['models', 'experiences.ts'],
    ['models', 'interests.ts'],
    ['models', 'site-settings.ts']
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
    stubRootModule(['models', 'personal-info.ts'], PersonalInfo);
    stubRootModule(['models', 'social-links.ts'], SocialLinks);
    stubRootModule(['models', 'skills.ts'], Skills);
    stubRootModule(['models', 'projects.ts'], Projects);
    stubRootModule(['models', 'blog-posts.ts'], BlogPosts);
    stubRootModule(['models', 'tags.ts'], Tags);
    stubRootModule(['models', 'contact-messages.ts'], ContactMessages);
    stubRootModule(['models', 'experiences.ts'], Experiences);
    stubRootModule(['models', 'interests.ts'], Interests);
    stubRootModule(['models', 'site-settings.ts'], SiteSettings);
    stubRootModule(['utils', 'cache.ts'], CacheUtils);

    return require(resolveFromRoot(['routes', 'public.ts']));
};

module.exports = {
    loadPublicRoute
};
