const express = require('express');
const router = express.Router();
const logger = require('../log');

const PersonalInfo = require('../models/personal-info');
const SocialLinks = require('../models/social-links');
const Skills = require('../models/skills');
const Projects = require('../models/projects');
const BlogPosts = require('../models/blog-posts');
const Tags = require('../models/tags');
const ContactMessages = require('../models/contact-messages');
const Experiences = require('../models/experiences');
const Interests = require('../models/interests');
const SiteSettings = require('../models/site-settings');
const CacheUtils = require('../utils/cache');
const { clampInteger, parsePagination } = require('../utils/pagination');
const { toBooleanOrNull, toCsvStringArray, toStringValue } = require('../utils/filter-values');

const PUBLIC_CACHE_TTL_SECONDS = Number(process.env.PUBLIC_CACHE_TTL_SECONDS || 300);
const PUBLIC_HTTP_MAX_AGE_SECONDS = Number(process.env.PUBLIC_HTTP_MAX_AGE_SECONDS || 60);
const PUBLIC_HTTP_STALE_SECONDS = Number(process.env.PUBLIC_HTTP_STALE_SECONDS || 300);

const CONTACT_FIELD_LIMITS = {
    name: 120,
    email: 255,
    subject: 255,
    message: 5000
};
const CONTACT_FIELD_LABELS = {
    name: '이름',
    email: '이메일',
    subject: '제목',
    message: '메시지'
};
const CONTACT_RECENT_WINDOW_HOURS = clampInteger(process.env.CONTACT_RECENT_WINDOW_HOURS, { fallback: 1, max: 24 });
const CONTACT_RECENT_IP_MAX = clampInteger(process.env.CONTACT_RECENT_IP_MAX, { fallback: 3, max: 50 });

const normalizeContactField = (value) => String(value ?? '').trim();

const validateContactLength = (field, value) => {
    const maxLength = CONTACT_FIELD_LIMITS[field];
    return !maxLength || value.length <= maxLength;
};

const stableStringify = (value) => {
    if (!value || typeof value !== 'object') {
        return String(value ?? '');
    }

    return JSON.stringify(
        Object.keys(value)
            .sort()
            .reduce((acc, key) => {
                const fieldValue = value[key];
                if (fieldValue !== undefined && fieldValue !== null && fieldValue !== '') {
                    acc[key] = fieldValue;
                }
                return acc;
            }, {})
    );
};

const setPublicCacheHeaders = (res) => {
    res.setHeader(
        'Cache-Control',
        `public, max-age=${PUBLIC_HTTP_MAX_AGE_SECONDS}, stale-while-revalidate=${PUBLIC_HTTP_STALE_SECONDS}`
    );
};

const ok = (res, data, extra = {}) => {
    setPublicCacheHeaders(res);
    return res.json({
        success: true,
        data,
        ...extra
    });
};

const notFound = (res, message = '요청한 공개 리소스를 찾을 수 없습니다.') => (
    res.status(404).json({
        success: false,
        message
    })
);

const fail = (res, error, req, message) => {
    logger.error(message, {
        requestId: req.requestId,
        path: req.originalUrl,
        method: req.method,
        error: error.message,
        stack: error.stack
    });

    return res.status(500).json({
        success: false,
        message
    });
};

const cacheKey = (prefix, ...parts) => CacheUtils.generateKey(prefix, 'public', ...parts);

const cached = async (key, loader, ttl = PUBLIC_CACHE_TTL_SECONDS) => (
    CacheUtils.cacheApiResponse(key, loader, ttl)
);

const buildProjectFilters = (query) => {
    const { limit, page, offset } = parsePagination(query, {
        defaultLimit: 10,
        maxLimit: 50
    });

    return {
        limit,
        page,
        offset,
        search: toStringValue(query.search),
        tags: toCsvStringArray(query.tags),
        skills: toCsvStringArray(query.skills),
        featured: toBooleanOrNull(query.featured),
        status: 'published',
        sort: toStringValue(query.sort, 'display_order'),
        order: toStringValue(query.order, 'asc'),
        published_only: true
    };
};

const buildPostFilters = (query) => {
    const { limit, page, offset } = parsePagination(query, {
        defaultLimit: 10,
        maxLimit: 50
    });

    return {
        limit,
        page,
        offset,
        search: toStringValue(query.search),
        tags: toCsvStringArray(query.tags),
        featured: toBooleanOrNull(query.featured),
        status: 'published',
        sort: toStringValue(query.sort, 'published_at'),
        order: toStringValue(query.order, 'desc'),
        published_only: true
    };
};

router.get('/profile', async (req, res) => {
    try {
        const data = await cached(cacheKey('personal_info', 'profile'), () => PersonalInfo.get());
        return ok(res, data);
    } catch (error) {
        return fail(res, error, req, '프로필 정보를 가져오는데 실패했습니다.');
    }
});

router.get('/settings', async (req, res) => {
    try {
        const data = await cached(cacheKey('settings', 'public'), () => SiteSettings.getPublicSettings());
        return ok(res, data);
    } catch (error) {
        return fail(res, error, req, '공개 설정 정보를 가져오는데 실패했습니다.');
    }
});

router.get('/social-links', async (req, res) => {
    try {
        const data = await cached(cacheKey('social_links', 'all'), () => SocialLinks.getAll());
        return ok(res, data);
    } catch (error) {
        return fail(res, error, req, '소셜 링크를 가져오는데 실패했습니다.');
    }
});

router.post('/contact', async (req, res) => {
    try {
        const name = normalizeContactField(req.body?.name);
        const email = normalizeContactField(req.body?.email).toLowerCase();
        const subject = normalizeContactField(req.body?.subject);
        const message = normalizeContactField(req.body?.message);

        if (!name || !email || !message) {
            return res.status(400).json({
                success: false,
                message: '이름, 이메일, 메시지는 필수입니다.'
            });
        }

        for (const [field, value] of Object.entries({ name, email, subject, message })) {
            if (!validateContactLength(field, value)) {
                return res.status(400).json({
                    success: false,
                    message: `${CONTACT_FIELD_LABELS[field]} 길이가 허용 범위를 초과했습니다.`
                });
            }
        }

        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            return res.status(400).json({
                success: false,
                message: '올바른 이메일 형식이 아닙니다.'
            });
        }

        const recentCount = await ContactMessages.countRecentByIp(req.ip, CONTACT_RECENT_WINDOW_HOURS);
        if (recentCount >= CONTACT_RECENT_IP_MAX) {
            res.setHeader('Cache-Control', 'no-store');
            return res.status(429).json({
                success: false,
                message: '문의 요청이 너무 많습니다. 잠시 후 다시 시도해주세요.'
            });
        }

        const id = await ContactMessages.create({
            name,
            email,
            subject: subject || null,
            message,
            ip_address: req.ip,
            user_agent: req.headers['user-agent']
        });

        res.setHeader('Cache-Control', 'no-store');
        return res.status(201).json({
            success: true,
            message: '메시지가 성공적으로 전송되었습니다.',
            data: { id }
        });
    } catch (error) {
        return fail(res, error, req, '메시지 전송에 실패했습니다.');
    }
});

router.get('/skills', async (req, res) => {
    try {
        const data = await cached(cacheKey('skills', 'all'), async () => {
            const [skills, categories] = await Promise.all([
                Skills.getAllWithCategories(),
                Skills.getCategories()
            ]);

            const skillsByCategory = categories.map((category) => ({
                ...category,
                skills: skills.filter((skill) => skill.category_id === category.id)
            }));

            return {
                skills,
                categories,
                skillsByCategory
            };
        });

        return ok(res, data);
    } catch (error) {
        return fail(res, error, req, '스킬 정보를 가져오는데 실패했습니다.');
    }
});

router.get('/skills/featured', async (req, res) => {
    try {
        const data = await cached(cacheKey('skills', 'featured'), () => Skills.getFeatured());
        return ok(res, data);
    } catch (error) {
        return fail(res, error, req, '주요 스킬 정보를 가져오는데 실패했습니다.');
    }
});

router.get('/projects', async (req, res) => {
    try {
        const filters = buildProjectFilters(req.query);
        const data = await cached(cacheKey('projects', stableStringify(filters)), async () => {
            const [projects, total] = await Promise.all([
                Projects.getWithFilters(filters),
                Projects.getCountWithFilters(filters)
            ]);

            return { projects, total };
        });

        return ok(res, data.projects, {
            pagination: {
                page: filters.page,
                limit: filters.limit,
                total: data.total,
                totalPages: Math.ceil(data.total / filters.limit)
            }
        });
    } catch (error) {
        return fail(res, error, req, '프로젝트 목록을 가져오는데 실패했습니다.');
    }
});

router.post('/projects/:slug/view', async (req, res) => {
    try {
        const project = await Projects.getBySlug(req.params.slug);
        if (!project || !project.is_published) {
            return notFound(res, '프로젝트를 찾을 수 없습니다.');
        }

        await Projects.incrementView(project.id);
        CacheUtils.del(cacheKey('project', 'slug', req.params.slug));
        CacheUtils.delPattern('projects:public:');

        res.setHeader('Cache-Control', 'no-store');
        return res.json({
            success: true,
            message: '조회수가 증가되었습니다.'
        });
    } catch (error) {
        return fail(res, error, req, '프로젝트 조회수 증가에 실패했습니다.');
    }
});

router.get('/projects/:slug', async (req, res) => {
    try {
        const data = await cached(cacheKey('project', 'slug', req.params.slug), () => Projects.getBySlug(req.params.slug));

        if (!data || !data.is_published) {
            return notFound(res, '프로젝트를 찾을 수 없습니다.');
        }

        return ok(res, data);
    } catch (error) {
        return fail(res, error, req, '프로젝트 정보를 가져오는데 실패했습니다.');
    }
});

router.get('/posts', async (req, res) => {
    try {
        const filters = buildPostFilters(req.query);
        const data = await cached(cacheKey('blog_posts', stableStringify(filters)), async () => {
            const [posts, total] = await Promise.all([
                BlogPosts.getWithFilters(filters),
                BlogPosts.getCountWithFilters(filters)
            ]);

            return { posts, total };
        });

        return ok(res, data.posts, {
            pagination: {
                page: filters.page,
                limit: filters.limit,
                total: data.total,
                totalPages: Math.ceil(data.total / filters.limit)
            }
        });
    } catch (error) {
        return fail(res, error, req, '블로그 글 목록을 가져오는데 실패했습니다.');
    }
});

router.get('/posts/tag/:tagSlug', async (req, res) => {
    try {
        const filters = buildPostFilters({
            ...req.query,
            tags: req.params.tagSlug
        });
        const data = await cached(cacheKey('blog_posts', 'tag', req.params.tagSlug, stableStringify(filters)), async () => {
            const [posts, total] = await Promise.all([
                BlogPosts.getWithFilters(filters),
                BlogPosts.getCountWithFilters(filters)
            ]);

            return { posts, total };
        });

        return ok(res, data.posts, {
            pagination: {
                page: filters.page,
                limit: filters.limit,
                total: data.total,
                totalPages: Math.ceil(data.total / filters.limit)
            }
        });
    } catch (error) {
        return fail(res, error, req, '태그별 블로그 글 목록을 가져오는데 실패했습니다.');
    }
});

router.post('/posts/:slug/view', async (req, res) => {
    try {
        const post = await BlogPosts.getBySlug(req.params.slug);
        if (!post) {
            return notFound(res, '블로그 글을 찾을 수 없습니다.');
        }

        await BlogPosts.incrementView(post.id);
        CacheUtils.del(cacheKey('blog_post', 'slug', req.params.slug));
        CacheUtils.delPattern('blog_posts:public:');

        res.setHeader('Cache-Control', 'no-store');
        return res.json({
            success: true,
            message: '조회수가 증가되었습니다.'
        });
    } catch (error) {
        return fail(res, error, req, '블로그 조회수 증가에 실패했습니다.');
    }
});

router.get('/posts/:slug', async (req, res) => {
    try {
        const data = await cached(cacheKey('blog_post', 'slug', req.params.slug), () => BlogPosts.getBySlug(req.params.slug));

        if (!data) {
            return notFound(res, '블로그 글을 찾을 수 없습니다.');
        }

        return ok(res, data);
    } catch (error) {
        return fail(res, error, req, '블로그 글 정보를 가져오는데 실패했습니다.');
    }
});

router.get('/tags', async (req, res) => {
    try {
        const { limit } = parsePagination(req.query, {
            defaultLimit: 20,
            maxLimit: 100
        });
        const type = toStringValue(req.query.type).trim() || null;
        const popular = toBooleanOrNull(req.query.popular);
        const key = cacheKey('tags', stableStringify({ limit, type, popular }));
        const data = await cached(key, () => (
            popular ? Tags.getPopular(limit, { type }) : Tags.getAll({ type })
        ));

        return ok(res, data);
    } catch (error) {
        return fail(res, error, req, '태그 정보를 가져오는데 실패했습니다.');
    }
});

router.get('/experiences', async (req, res) => {
    try {
        const type = toStringValue(req.query.type).trim() || null;
        const key = cacheKey('experiences', stableStringify({ type }));
        const data = await cached(key, () => (
            type ? Experiences.getByType(type) : Experiences.getAll()
        ));

        return ok(res, data);
    } catch (error) {
        return fail(res, error, req, '경력 정보를 가져오는데 실패했습니다.');
    }
});

router.get('/experiences/timeline', async (req, res) => {
    try {
        const data = await cached(cacheKey('experiences', 'timeline'), () => Experiences.getTimeline());
        return ok(res, data);
    } catch (error) {
        return fail(res, error, req, '타임라인 정보를 가져오는데 실패했습니다.');
    }
});

router.get('/interests', async (req, res) => {
    try {
        const category = toStringValue(req.query.category).trim() || null;
        const key = cacheKey('interests', stableStringify({ category }));
        const data = await cached(key, () => (
            category ? Interests.getByCategory(category) : Interests.getAll()
        ));

        return ok(res, data);
    } catch (error) {
        return fail(res, error, req, '관심사 정보를 가져오는데 실패했습니다.');
    }
});

module.exports = router;
