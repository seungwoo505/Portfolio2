const express = require('express');
const crypto = require('crypto');
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
const { toOptionalBoolean, toCsvStringArray, toStringValue } = require('../utils/filter-values');
const { isValidSlug } = require('../utils/slug');

const PUBLIC_CACHE_TTL_SECONDS = clampInteger(process.env.PUBLIC_CACHE_TTL_SECONDS, {
    fallback: 300,
    max: 86400
});
const PUBLIC_HTTP_MAX_AGE_SECONDS = clampInteger(process.env.PUBLIC_HTTP_MAX_AGE_SECONDS, {
    fallback: 60,
    max: 86400
});
const PUBLIC_HTTP_STALE_SECONDS = clampInteger(process.env.PUBLIC_HTTP_STALE_SECONDS, {
    fallback: 300,
    max: 604800
});
const PUBLIC_VIEW_DEDUPE_TTL_SECONDS = clampInteger(process.env.PUBLIC_VIEW_DEDUPE_TTL_SECONDS, {
    fallback: 300,
    max: 86400
});

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
const CONTACT_DUPLICATE_TTL_SECONDS = clampInteger(process.env.CONTACT_DUPLICATE_TTL_SECONDS, {
    fallback: 300,
    max: 86400
});

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

const badRequest = (res, message) => (
    res.status(400).json({
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

const hashCachePart = (value) => (
    crypto.createHash('sha256').update(String(value || 'unknown')).digest('hex').slice(0, 16)
);

const getClientFingerprint = (req) => hashCachePart([
    req.ip,
    req.headers['user-agent'] || ''
].join('|'));

const getViewDedupeKey = (resourceType, slug, req) => cacheKey(
    'view_dedupe',
    resourceType,
    slug,
    getClientFingerprint(req)
);

const getContactDuplicateKey = ({ email, message, req }) => cacheKey(
    'contact_duplicate',
    hashCachePart([
        email,
        message,
        getClientFingerprint(req)
    ].join('|'))
);

const incrementViewOnce = async ({ resourceType, slug, req, increment, invalidate }) => {
    const dedupeKey = getViewDedupeKey(resourceType, slug, req);
    if (CacheUtils.get(dedupeKey)) {
        return false;
    }

    await increment();
    CacheUtils.set(dedupeKey, true, PUBLIC_VIEW_DEDUPE_TTL_SECONDS);
    invalidate();
    return true;
};

const buildProjectFilters = (query) => {
    const featured = toOptionalBoolean(query.featured);
    if (!featured.isValid) {
        return {
            error: 'featured 값은 boolean이어야 합니다.'
        };
    }

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
        featured: featured.value,
        status: 'published',
        sort: toStringValue(query.sort, 'display_order'),
        order: toStringValue(query.order, 'asc'),
        published_only: true
    };
};

const buildPostFilters = (query) => {
    const featured = toOptionalBoolean(query.featured);
    if (!featured.isValid) {
        return {
            error: 'featured 값은 boolean이어야 합니다.'
        };
    }

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
        featured: featured.value,
        status: 'published',
        sort: toStringValue(query.sort, 'published_at'),
        order: toStringValue(query.order, 'desc'),
        published_only: true
    };
};

/**
 * @swagger
 * /api/public/profile:
 *   get:
 *     summary: 공개 프로필 조회
 *     tags: ['Public']
 *     responses:
 *       200:
 *         description: 프로필 조회 성공
 *       500:
 *         description: 서버 오류
 * /api/public/settings:
 *   get:
 *     summary: 공개 사이트 설정 조회
 *     tags: ['Public']
 *     responses:
 *       200:
 *         description: 설정 조회 성공
 *       500:
 *         description: 서버 오류
 * /api/public/social-links:
 *   get:
 *     summary: 공개 소셜 링크 조회
 *     tags: ['Public']
 *     responses:
 *       200:
 *         description: 소셜 링크 조회 성공
 *       500:
 *         description: 서버 오류
 * /api/public/contact:
 *   post:
 *     summary: 문의 메시지 접수
 *     tags: ['Public']
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [name, email, subject, message]
 *             properties:
 *               name:
 *                 type: string
 *               email:
 *                 type: string
 *                 format: email
 *               subject:
 *                 type: string
 *               message:
 *                 type: string
 *     responses:
 *       201:
 *         description: 문의 접수 성공
 *       400:
 *         description: 잘못된 요청
 *       409:
 *         description: 중복 문의
 *       429:
 *         description: 요청 제한 초과
 *       500:
 *         description: 서버 오류
 * /api/public/skills:
 *   get:
 *     summary: 공개 기술 스택 조회
 *     tags: ['Public']
 *     responses:
 *       200:
 *         description: 기술 스택 조회 성공
 *       500:
 *         description: 서버 오류
 * /api/public/skills/featured:
 *   get:
 *     summary: 주요 기술 스택 조회
 *     tags: ['Public']
 *     responses:
 *       200:
 *         description: 주요 기술 조회 성공
 *       500:
 *         description: 서버 오류
 * /api/public/projects:
 *   get:
 *     summary: 공개 프로젝트 목록 조회
 *     tags: ['Public']
 *     parameters:
 *       - in: query
 *         name: featured
 *         schema:
 *           type: boolean
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *       - in: query
 *         name: tags
 *         schema:
 *           type: string
 *       - in: query
 *         name: skills
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: 프로젝트 목록 조회 성공
 *       400:
 *         description: 잘못된 query 값
 *       500:
 *         description: 서버 오류
 * /api/public/projects/{slug}:
 *   get:
 *     summary: 공개 프로젝트 상세 조회
 *     tags: ['Public']
 *     parameters:
 *       - in: path
 *         name: slug
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: 프로젝트 상세 조회 성공
 *       400:
 *         description: 잘못된 slug
 *       404:
 *         description: 프로젝트 없음
 *       500:
 *         description: 서버 오류
 * /api/public/projects/{slug}/view:
 *   post:
 *     summary: 프로젝트 조회수 증가
 *     tags: ['Public']
 *     parameters:
 *       - in: path
 *         name: slug
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: 조회수 증가 성공
 *       400:
 *         description: 잘못된 slug
 *       404:
 *         description: 프로젝트 없음
 *       500:
 *         description: 서버 오류
 * /api/public/posts:
 *   get:
 *     summary: 공개 블로그 글 목록 조회
 *     tags: ['Public']
 *     parameters:
 *       - in: query
 *         name: featured
 *         schema:
 *           type: boolean
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *       - in: query
 *         name: tags
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: 블로그 글 목록 조회 성공
 *       400:
 *         description: 잘못된 query 값
 *       500:
 *         description: 서버 오류
 * /api/public/posts/tag/{tagSlug}:
 *   get:
 *     summary: 태그별 공개 블로그 글 목록 조회
 *     tags: ['Public']
 *     parameters:
 *       - in: path
 *         name: tagSlug
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: 태그별 블로그 글 조회 성공
 *       400:
 *         description: 잘못된 slug 또는 query 값
 *       500:
 *         description: 서버 오류
 * /api/public/posts/{slug}:
 *   get:
 *     summary: 공개 블로그 글 상세 조회
 *     tags: ['Public']
 *     parameters:
 *       - in: path
 *         name: slug
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: 블로그 글 상세 조회 성공
 *       400:
 *         description: 잘못된 slug
 *       404:
 *         description: 블로그 글 없음
 *       500:
 *         description: 서버 오류
 * /api/public/posts/{slug}/view:
 *   post:
 *     summary: 블로그 글 조회수 증가
 *     tags: ['Public']
 *     parameters:
 *       - in: path
 *         name: slug
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: 조회수 증가 성공
 *       400:
 *         description: 잘못된 slug
 *       404:
 *         description: 블로그 글 없음
 *       500:
 *         description: 서버 오류
 * /api/public/tags:
 *   get:
 *     summary: 공개 태그 목록 조회
 *     tags: ['Public']
 *     parameters:
 *       - in: query
 *         name: popular
 *         schema:
 *           type: boolean
 *       - in: query
 *         name: type
 *         schema:
 *           type: string
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: 태그 목록 조회 성공
 *       400:
 *         description: 잘못된 query 값
 *       500:
 *         description: 서버 오류
 * /api/public/experiences:
 *   get:
 *     summary: 공개 경력 목록 조회
 *     tags: ['Public']
 *     responses:
 *       200:
 *         description: 경력 목록 조회 성공
 *       500:
 *         description: 서버 오류
 * /api/public/experiences/timeline:
 *   get:
 *     summary: 공개 타임라인 조회
 *     tags: ['Public']
 *     responses:
 *       200:
 *         description: 타임라인 조회 성공
 *       500:
 *         description: 서버 오류
 * /api/public/interests:
 *   get:
 *     summary: 공개 관심사 목록 조회
 *     tags: ['Public']
 *     responses:
 *       200:
 *         description: 관심사 목록 조회 성공
 *       500:
 *         description: 서버 오류
 */
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

        const duplicateKey = getContactDuplicateKey({ email, message, req });
        if (CacheUtils.get(duplicateKey)) {
            res.setHeader('Cache-Control', 'no-store');
            return res.status(409).json({
                success: false,
                message: '같은 문의가 이미 접수되었습니다.'
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
        CacheUtils.set(duplicateKey, true, CONTACT_DUPLICATE_TTL_SECONDS);

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
        if (filters.error) {
            return badRequest(res, filters.error);
        }
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
        const { slug } = req.params;
        if (!isValidSlug(slug)) {
            return badRequest(res, '유효한 slug가 필요합니다.');
        }

        const project = await Projects.getBySlug(slug);
        if (!project || !project.is_published) {
            return notFound(res, '프로젝트를 찾을 수 없습니다.');
        }

        await incrementViewOnce({
            resourceType: 'project',
            slug,
            req,
            increment: () => Projects.incrementView(project.id),
            invalidate: () => {
                CacheUtils.del(cacheKey('project', 'slug', slug));
                CacheUtils.delPattern('projects:public:');
            }
        });

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
        const { slug } = req.params;
        if (!isValidSlug(slug)) {
            return badRequest(res, '유효한 slug가 필요합니다.');
        }

        const data = await cached(cacheKey('project', 'slug', slug), () => Projects.getBySlug(slug));

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
        if (filters.error) {
            return badRequest(res, filters.error);
        }
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
        const { tagSlug } = req.params;
        if (!isValidSlug(tagSlug)) {
            return badRequest(res, '유효한 slug가 필요합니다.');
        }

        const filters = buildPostFilters({
            ...req.query,
            tags: tagSlug
        });
        if (filters.error) {
            return badRequest(res, filters.error);
        }

        const data = await cached(cacheKey('blog_posts', 'tag', tagSlug, stableStringify(filters)), async () => {
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
        const { slug } = req.params;
        if (!isValidSlug(slug)) {
            return badRequest(res, '유효한 slug가 필요합니다.');
        }

        const post = await BlogPosts.getBySlug(slug);
        if (!post) {
            return notFound(res, '블로그 글을 찾을 수 없습니다.');
        }

        await incrementViewOnce({
            resourceType: 'post',
            slug,
            req,
            increment: () => BlogPosts.incrementView(post.id),
            invalidate: () => {
                CacheUtils.del(cacheKey('blog_post', 'slug', slug));
                CacheUtils.delPattern('blog_posts:public:');
            }
        });

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
        const { slug } = req.params;
        if (!isValidSlug(slug)) {
            return badRequest(res, '유효한 slug가 필요합니다.');
        }

        const data = await cached(cacheKey('blog_post', 'slug', slug), () => BlogPosts.getBySlug(slug));

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
        const popular = toOptionalBoolean(req.query.popular);
        if (!popular.isValid) {
            return badRequest(res, 'popular 값은 boolean이어야 합니다.');
        }

        const popularValue = popular.value === true;
        const key = cacheKey('tags', stableStringify({ limit, type, popular: popularValue }));
        const data = await cached(key, () => (
            popularValue ? Tags.getPopular(limit, { type }) : Tags.getAll({ type })
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
