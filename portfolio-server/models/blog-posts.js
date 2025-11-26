const { executeQuery, executeQuerySingle } = require('./db-utils');
const { v4: uuidv4 } = require('uuid');
const CacheUtils = require('../utils/cache');

const BlogPosts = {
    async getAll(limit = 10, offset = 0, published_only = true) {
        const cacheKey = CacheUtils.generateKey('blog_posts', 'all', limit, offset, published_only);
        
        return await CacheUtils.cacheApiResponse(cacheKey, async () => {
            let whereClause = published_only ? 'WHERE bp.is_published = TRUE' : '';
            
            const query = `
                SELECT bp.*, 
                       GROUP_CONCAT(DISTINCT t.name ORDER BY t.name ASC) as tags
                FROM blog_posts bp
                LEFT JOIN tag_usage tu ON tu.content_type = 'blog_post' AND tu.content_id = bp.id
                LEFT JOIN tags t ON tu.tag_id = t.id
                ${whereClause}
                GROUP BY bp.id
                ORDER BY bp.is_featured DESC, bp.published_at DESC, bp.created_at DESC
                LIMIT ? OFFSET ?
            `;
            
            const posts = await executeQuery(query, [limit, offset]);
            return posts.map(post => ({
                ...post,
                featured: Boolean(post.is_featured), // is_featured를 boolean으로 변환
                tags: post.tags ? post.tags.split(',') : []
            }));
        }, 300); // 5분 캐시
    },

    async getWithFilters(filters = {}) {
        const {
            limit = 10,
            offset = 0,
            search = '',
            tags = [],
            featured = null,
            status = 'published', // 'published', 'draft', 'all'
            sort = 'published_at', // 'published_at', 'created_at', 'title', 'view_count'
            order = 'desc', // 'asc', 'desc'
            published_only = true
        } = filters;

        let whereConditions = [];
        let queryParams = [];

        if (status === 'published') {
            whereConditions.push('bp.is_published = TRUE');
        } else if (status === 'draft') {
            whereConditions.push('bp.is_published = FALSE');
        } else if (published_only) {
            whereConditions.push('bp.is_published = TRUE');
        }

        if (featured !== null) {
            whereConditions.push('bp.is_featured = ?');
            queryParams.push(featured ? 1 : 0);
        }

        if (tags && tags.length > 0) {
            const tagPlaceholders = tags.map(() => '?').join(',');
            whereConditions.push(`
                bp.id IN (
                    SELECT tu.content_id 
                    FROM tag_usage tu 
                    INNER JOIN tags t ON tu.tag_id = t.id 
                    WHERE tu.content_type = 'blog_post' 
                    AND t.slug IN (${tagPlaceholders})
                )
            `);
            queryParams.push(...tags);
        }

        if (search && search.trim()) {
            const searchTerm = `%${search.trim()}%`;
            whereConditions.push(`(
                bp.title LIKE ? OR 
                bp.excerpt LIKE ? OR 
                bp.content LIKE ? OR
                bp.meta_keywords LIKE ?
            )`);
            queryParams.push(searchTerm, searchTerm, searchTerm, searchTerm);
        }

        const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';

        let orderClause = '';
        const validSortFields = ['published_at', 'created_at', 'title', 'view_count', 'reading_time'];
        const validOrders = ['asc', 'desc'];
        
        const sortField = validSortFields.includes(sort) ? sort : 'published_at';
        const sortOrder = validOrders.includes(order.toLowerCase()) ? order.toUpperCase() : 'DESC';
        
        orderClause = `ORDER BY bp.is_featured DESC, bp.${sortField} ${sortOrder}`;

        const query = `
            SELECT bp.*, 
                   GROUP_CONCAT(DISTINCT t.name ORDER BY t.name ASC) as tags
            FROM blog_posts bp
            LEFT JOIN tag_usage tu ON tu.content_type = 'blog_post' AND tu.content_id = bp.id
            LEFT JOIN tags t ON tu.tag_id = t.id
            ${whereClause}
            GROUP BY bp.id
            ${orderClause}
            LIMIT ? OFFSET ?
        `;

        queryParams.push(limit, offset);
        const posts = await executeQuery(query, queryParams);

        return posts.map(post => ({
            ...post,
            featured: Boolean(post.is_featured),
            tags: post.tags ? post.tags.split(',') : []
        }));
    },

    async getCountWithFilters(filters = {}) {
        const {
            search = '',
            tags = [],
            featured = null,
            status = 'published',
            published_only = true
        } = filters;

        let whereConditions = [];
        let queryParams = [];

        if (status === 'published') {
            whereConditions.push('bp.is_published = TRUE');
        } else if (status === 'draft') {
            whereConditions.push('bp.is_published = FALSE');
        } else if (published_only) {
            whereConditions.push('bp.is_published = TRUE');
        }

        if (featured !== null) {
            whereConditions.push('bp.is_featured = ?');
            queryParams.push(featured ? 1 : 0);
        }

        if (tags && tags.length > 0) {
            const tagPlaceholders = tags.map(() => '?').join(',');
            whereConditions.push(`
                bp.id IN (
                    SELECT tu.content_id 
                    FROM tag_usage tu 
                    INNER JOIN tags t ON tu.tag_id = t.id 
                    WHERE tu.content_type = 'blog_post' 
                    AND t.slug IN (${tagPlaceholders})
                )
            `);
            queryParams.push(...tags);
        }

        if (search && search.trim()) {
            const searchTerm = `%${search.trim()}%`;
            whereConditions.push(`(
                bp.title LIKE ? OR 
                bp.excerpt LIKE ? OR 
                bp.content LIKE ? OR
                bp.meta_keywords LIKE ?
            )`);
            queryParams.push(searchTerm, searchTerm, searchTerm, searchTerm);
        }

        const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';

        const query = `
            SELECT COUNT(DISTINCT bp.id) as total
            FROM blog_posts bp
            LEFT JOIN tag_usage tu ON tu.content_type = 'blog_post' AND tu.content_id = bp.id
            LEFT JOIN tags t ON tu.tag_id = t.id
            ${whereClause}
        `;

        const result = await executeQuerySingle(query, queryParams);
        return result.total || 0;
    },

    async getBySlug(slug) {
        const cacheKey = CacheUtils.generateKey('blog_post', 'slug', slug);
        
        return await CacheUtils.cacheApiResponse(cacheKey, async () => {
            const post = await executeQuerySingle(`
                SELECT * FROM blog_posts WHERE slug = ? AND is_published = TRUE
            `, [slug]);
            
            if (!post) return null;

            const tags = await executeQuery(`
                SELECT t.* FROM tags t
                INNER JOIN tag_usage tu ON t.id = tu.tag_id
                WHERE tu.content_type = 'blog_post' AND tu.content_id = ?
            `, [post.id]);

            return {
                ...post,
                featured: Boolean(post.is_featured), // is_featured를 boolean으로 변환
                tags
            };
        }, 600); // 10분 캐시 (개별 포스트는 더 오래 캐시)
    },

    async getBySlugAdmin(slug) {
        const cacheKey = CacheUtils.generateKey('blog_post_admin', 'slug', slug);
        
        return await CacheUtils.cacheApiResponse(cacheKey, async () => {
            const post = await executeQuerySingle(`
                SELECT * FROM blog_posts WHERE slug = ?
            `, [slug]);
            
            if (!post) return null;

            const tags = await executeQuery(`
                SELECT t.* FROM tags t
                INNER JOIN tag_usage tu ON t.id = tu.tag_id
                WHERE tu.content_type = 'blog_post' AND tu.content_id = ?
            `, [post.id]);

            return {
                ...post,
                featured: Boolean(post.is_featured), // is_featured를 boolean으로 변환
                tags
            };
        }, 600); // 10분 캐시 (개별 포스트는 더 오래 캐시)
    },

    async getById(id) {
        const post = await executeQuerySingle('SELECT * FROM blog_posts WHERE id = ?', [id]);
        
        if (!post) return null;

        const tags = await executeQuery(`
            SELECT t.* FROM tags t
            INNER JOIN tag_usage tu ON t.id = tu.tag_id
            WHERE tu.content_type = 'blog_post' AND tu.content_id = ?
        `, [post.id]);

        return {
            ...post,
            featured: Boolean(post.is_featured), // is_featured를 boolean으로 변환
            tags
        };
    },

    async getByUuid(uuid) {
        return await executeQuerySingle('SELECT * FROM blog_posts WHERE uuid = ?', [uuid]);
    },

    async _create(data) {
        const { title, slug, excerpt, content, featured_image, is_published, is_featured, meta_title, meta_description, meta_keywords, tags } = data;
        const uuid = uuidv4();
        
        const finalSlug = slug || title.toLowerCase().replace(/[^a-z0-9]/g, '-').replace(/-+/g, '-').trim('-');
        
        const reading_time = Math.ceil(content.split(' ').length / 200);
        
        const query = `
            INSERT INTO blog_posts (uuid, title, slug, excerpt, content, featured_image, is_published, is_featured, reading_time, meta_title, meta_description, meta_keywords, published_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `;
        
        const published_at = is_published ? new Date() : null;
        const result = await executeQuery(query, [uuid, title, finalSlug, excerpt, content, featured_image, is_published || false, is_featured || false, reading_time, meta_title, meta_description, meta_keywords, published_at]);
        
        if (tags && tags.length > 0) {
            await this.updateTags(result.insertId, tags);
        }
        
        return result.insertId;
    },

    async _update(id, data) {
        const { title, slug, excerpt, content, featured_image, is_published, is_featured, meta_title, meta_description, meta_keywords, tags } = data;
        
        const cleanData = {
            title: title === undefined ? null : title,
            slug: slug === undefined ? null : slug,
            excerpt: excerpt === undefined ? null : excerpt,
            content: content === undefined ? null : content,
            featured_image: featured_image === undefined ? null : featured_image,
            is_published: is_published === undefined ? null : is_published,
            is_featured: is_featured === undefined ? null : is_featured,
            meta_title: meta_title === undefined ? null : meta_title,
            meta_description: meta_description === undefined ? null : meta_description,
            meta_keywords: meta_keywords === undefined ? null : meta_keywords
        };
        
        const reading_time = cleanData.content ? Math.ceil(cleanData.content.split(' ').length / 200) : null;
        
        let query = `
            UPDATE blog_posts 
            SET title = COALESCE(?, title), 
                slug = COALESCE(?, slug), 
                excerpt = COALESCE(?, excerpt), 
                content = COALESCE(?, content), 
                featured_image = COALESCE(?, featured_image), 
                is_published = COALESCE(?, is_published), 
                is_featured = COALESCE(?, is_featured), 
                meta_title = COALESCE(?, meta_title), 
                meta_description = COALESCE(?, meta_description),
                meta_keywords = COALESCE(?, meta_keywords),
                reading_time = COALESCE(?, reading_time),
                updated_at = NOW()
        `;
        
        if (is_published !== undefined) {
            query += `, published_at = ${is_published ? 'NOW()' : 'NULL'}`;
        }
        
        query += ` WHERE id = ?`;
        
        await executeQuery(query, [cleanData.title, cleanData.slug, cleanData.excerpt, cleanData.content, cleanData.featured_image, cleanData.is_published, cleanData.is_featured, cleanData.meta_title, cleanData.meta_description, cleanData.meta_keywords, reading_time, id]);
        
        if (tags) {
            await this.updateTags(id, tags);
        }
        
        return await this.getById(id);
    },

    async _delete(id) {
        await executeQuery("DELETE FROM tag_usage WHERE content_type = 'blog_post' AND content_id = ?", [id]);
        await executeQuery('DELETE FROM blog_posts WHERE id = ?', [id]);
        
        await executeQuery('UPDATE tags t LEFT JOIN (SELECT tag_id, COUNT(*) cnt FROM tag_usage GROUP BY tag_id) u ON t.id = u.tag_id SET t.usage_count = COALESCE(u.cnt, 0)');
    },

    async updateTags(postId, tagNames) {
        await executeQuery("DELETE FROM tag_usage WHERE content_type = 'blog_post' AND content_id = ?", [postId]);
        
        const tagArray = Array.isArray(tagNames) ? tagNames : (typeof tagNames === 'string' ? tagNames.split(',') : []);
        
        for (const tagName of tagArray) {
            let tag = await executeQuerySingle('SELECT id FROM tags WHERE name = ?', [tagName.trim()]);
            
            if (!tag) {
                const tagSlug = tagName.toLowerCase().replace(/[^a-z0-9]/g, '-').replace(/-+/g, '-').trim('-');
                const result = await executeQuery("INSERT INTO tags (name, slug, type) VALUES (?, ?, 'blog')", [tagName.trim(), tagSlug]);
                tag = { id: result.insertId };
            }
            
            await executeQuery("INSERT IGNORE INTO tag_usage (tag_id, content_type, content_id) VALUES (?, 'blog_post', ?)", [tag.id, postId]);
        }
        
        await executeQuery('UPDATE tags t LEFT JOIN (SELECT tag_id, COUNT(*) cnt FROM tag_usage GROUP BY tag_id) u ON t.id = u.tag_id SET t.usage_count = COALESCE(u.cnt, 0)');
    },

    async updateTagCounts() {
        await executeQuery('UPDATE tags t LEFT JOIN (SELECT tag_id, COUNT(*) cnt FROM tag_usage GROUP BY tag_id) u ON t.id = u.tag_id SET t.usage_count = COALESCE(u.cnt, 0)');
    },

    async incrementView(id) {
        await executeQuery('UPDATE blog_posts SET view_count = view_count + 1 WHERE id = ?', [id]);
    },

    async search(query, limit = 10) {
        const searchQuery = `
            SELECT bp.*, 
                   GROUP_CONCAT(DISTINCT t.name ORDER BY t.name ASC) as tags,
                   MATCH(bp.title, bp.content) AGAINST(? IN NATURAL LANGUAGE MODE) as relevance
            FROM blog_posts bp
            LEFT JOIN tag_usage tu ON tu.content_type = 'blog_post' AND tu.content_id = bp.id
            LEFT JOIN tags t ON tu.tag_id = t.id
            WHERE bp.is_published = TRUE AND (
                MATCH(bp.title, bp.content) AGAINST(? IN NATURAL LANGUAGE MODE) OR
                bp.title LIKE ? OR
                bp.content LIKE ? OR
                t.name LIKE ?
            )
            GROUP BY bp.id
            ORDER BY relevance DESC, bp.published_at DESC
            LIMIT ?
        `;
        
        const searchTerm = `%${query}%`;
        const posts = await executeQuery(searchQuery, [query, query, searchTerm, searchTerm, searchTerm, limit]);
        
        return posts.map(post => ({
            ...post,
            tags: post.tags ? post.tags.split(',') : []
        }));
    },

    async getByTag(tagSlug, limit = 10, offset = 0) {
        const query = `
            SELECT bp.*, 
                   GROUP_CONCAT(DISTINCT t.name ORDER BY t.name ASC) as tags
            FROM blog_posts bp
            INNER JOIN tag_usage tu ON tu.content_type = 'blog_post' AND tu.content_id = bp.id
            INNER JOIN tags t ON tu.tag_id = t.id
            WHERE t.slug = ? AND bp.is_published = TRUE
            GROUP BY bp.id
            ORDER BY bp.published_at DESC
            LIMIT ? OFFSET ?
        `;
        
        const posts = await executeQuery(query, [tagSlug, limit, offset]);
        return posts.map(post => ({
            ...post,
            tags: post.tags ? post.tags.split(',') : []
        }));
    },

    async getFeatured(limit = 5, offset = 0) {
        const cacheKey = CacheUtils.generateKey('blog_posts', 'featured', limit, offset);
        
        return await CacheUtils.cacheApiResponse(cacheKey, async () => {
            const posts = await executeQuery(`
                SELECT bp.*, 
                       GROUP_CONCAT(DISTINCT t.name ORDER BY t.name ASC) as tags
                FROM blog_posts bp
                LEFT JOIN tag_usage tu ON tu.content_type = 'blog_post' AND tu.content_id = bp.id
                LEFT JOIN tags t ON tu.tag_id = t.id
                WHERE bp.is_published = TRUE AND bp.is_featured = TRUE
                GROUP BY bp.id
                ORDER BY bp.published_at DESC
                LIMIT ? OFFSET ?
            `, [limit, offset]);
            
            return posts.map(post => ({
                ...post,
                featured: Boolean(post.is_featured), // is_featured를 boolean으로 변환
                tags: post.tags ? post.tags.split(',') : []
            }));
        }, 300); // 5분 캐시
    },

    invalidateCache(postId = null) {
        if (postId) {
            CacheUtils.delPattern(`blog_post:${postId}:*`);
        }
        
        CacheUtils.delPattern('blog_posts:*');
        CacheUtils.delPattern('blog_post:slug:*');
        CacheUtils.delPattern('blog_posts:featured:*');
    },

    async create(data) {
        const result = await this._create(data);
        this.invalidateCache();
        return result;
    },

    async update(id, data) {
        const result = await this._update(id, data);
        this.invalidateCache(id);
        return result;
    },

    async delete(id) {
        const result = await this._delete(id);
        this.invalidateCache(id);
        return result;
    }
};

module.exports = BlogPosts;
