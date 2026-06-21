const {
    clearRootModules,
    createNoopLogger,
    resolveFromRoot,
    stubRootModule
} = require('./module-loader');
const { createCacheStub } = require('./cache-stub');

const publicRouteModules = [
    ['routes', 'public.js'],
    ['routes', 'public', 'index.js'],
    ['routes', 'public', 'common.js'],
    ['routes', 'public', 'common', 'cache.js'],
    ['routes', 'public', 'common', 'config.js'],
    ['routes', 'public', 'common', 'contact.js'],
    ['routes', 'public', 'common', 'filters.js'],
    ['routes', 'public', 'common', 'index.js'],
    ['routes', 'public', 'common', 'resources.js'],
    ['routes', 'public', 'common', 'responses.js'],
    ['routes', 'public', 'common', 'views.js'],
    ['routes', 'public', 'profile.js'],
    ['routes', 'public', 'contact.js'],
    ['routes', 'public', 'skills.js'],
    ['routes', 'public', 'projects.js'],
    ['routes', 'public', 'posts.js'],
    ['routes', 'public', 'tags.js'],
    ['routes', 'public', 'experiences.js'],
    ['routes', 'public', 'interests.js']
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

    return require(resolveFromRoot(['routes', 'public.js']));
};

module.exports = {
    loadPublicRoute
};
