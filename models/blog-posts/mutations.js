const {
    createQueryContext,
    createUniqueSlug,
    crypto,
    executeTransaction
} = require('./common');

module.exports = {
    /**
     * @description 블로그 글을 생성하는 내부 헬퍼.
     * @param {Object} data 블로그 글 데이터
     * @returns {Promise<number>} 생성된 글 ID
     */
    async _create(data) {
        const { title, slug, excerpt, content, featured_image, is_published, is_featured, meta_title, meta_description, meta_keywords, tags } = data;
        const uuid = crypto.randomUUID();

        return await executeTransaction(async (connection) => {
            const db = createQueryContext(connection);
            const finalSlug = await createUniqueSlug({
                value: title,
                providedSlug: slug,
                fallback: 'post',
                maxLength: 255,
                exists: async candidate => !!(await db.querySingle(
                    'SELECT id FROM blog_posts WHERE slug = ? LIMIT 1',
                    [candidate]
                ))
            });

            const reading_time = Math.ceil(content.split(' ').length / 200);

            const query = `
                INSERT INTO blog_posts (uuid, title, slug, excerpt, content, featured_image, is_published, is_featured, reading_time, meta_title, meta_description, meta_keywords, published_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `;

            const published_at = is_published ? new Date() : null;
            const result = await db.query(query, [uuid, title, finalSlug, excerpt, content, featured_image, is_published || false, is_featured || false, reading_time, meta_title, meta_description, meta_keywords, published_at]);

            if (tags && tags.length > 0) {
                await this.updateTags(result.insertId, tags, db);
            }

            return result.insertId;
        });
    },

    /**
     * @description 블로그 글을 업데이트하는 내부 헬퍼.
     * @param {number} id 블로그 글 ID
     * @param {Object} data 업데이트할 데이터
     * @returns {Promise<void>}
     */
    async _update(id, data) {
        const { title, slug, excerpt, content, featured_image, is_published, is_featured, meta_title, meta_description, meta_keywords, tags } = data;

        await executeTransaction(async (connection) => {
            const db = createQueryContext(connection);
            let finalSlug = null;
            const updateFields = [];
            const updateValues = [];

            if (slug !== undefined || title !== undefined) {
                finalSlug = await createUniqueSlug({
                    value: title,
                    providedSlug: slug,
                    fallback: 'post',
                    maxLength: 255,
                    exists: async candidate => !!(await db.querySingle(
                        'SELECT id FROM blog_posts WHERE slug = ? AND id != ? LIMIT 1',
                        [candidate, id]
                    ))
                });
            }

            const pushField = (field, value) => {
                if (value !== undefined) {
                    updateFields.push(`${field} = ?`);
                    updateValues.push(value);
                }
            };

            pushField('title', title);
            if (slug !== undefined || title !== undefined) {
                pushField('slug', finalSlug);
            }
            pushField('excerpt', excerpt);
            pushField('featured_image', featured_image);
            pushField('is_published', is_published);
            pushField('is_featured', is_featured);
            pushField('meta_title', meta_title);
            pushField('meta_description', meta_description);
            pushField('meta_keywords', meta_keywords);

            if (content !== undefined) {
                pushField('content', content);
                pushField('reading_time', content ? Math.ceil(content.split(' ').length / 200) : null);
            }

            if (is_published !== undefined) {
                updateFields.push(`published_at = ${is_published ? 'NOW()' : 'NULL'}`);
            }

            if (updateFields.length > 0) {
                updateFields.push('updated_at = NOW()');
                updateValues.push(id);

                await db.query(`UPDATE blog_posts SET ${updateFields.join(', ')} WHERE id = ?`, updateValues);
            }

            if (tags !== undefined) {
                await this.updateTags(id, tags || [], db);
            }
        });

        return await this.getById(id);
    },

    /**
     * @description 블로그 글을 삭제하는 내부 헬퍼.
     * @param {number} id 블로그 글 ID
     * @returns {Promise<void>}
     */
    async _delete(id) {
        await executeTransaction(async (connection) => {
            const db = createQueryContext(connection);

            await db.query("DELETE FROM tag_usage WHERE content_type = 'blog_post' AND content_id = ?", [id]);
            await db.query('DELETE FROM blog_posts WHERE id = ?', [id]);
            await db.query('UPDATE tags t LEFT JOIN (SELECT tag_id, COUNT(*) cnt FROM tag_usage GROUP BY tag_id) u ON t.id = u.tag_id SET t.usage_count = COALESCE(u.cnt, 0)');
        });
    },

    /**
     * @description 블로그 글을 생성하고 캐시를 무효화한다.
     * @param {Object} data 블로그 글 데이터
     * @returns {Promise<number>} 생성된 글 ID
     */
    async create(data) {
        const result = await this._create(data);
        this.invalidateCache();
        return result;
    },

    /**
     * @description 블로그 글을 수정하고 관련 캐시를 갱신한다.
     * @param {number} id 블로그 글 ID
     * @param {Object} data 수정할 데이터
     * @returns {Promise<void>}
     */
    async update(id, data) {
        const result = await this._update(id, data);
        this.invalidateCache(id);
        return result;
    },

    /**
     * @description 블로그 글을 삭제하고 관련 캐시를 무효화한다.
     * @param {number} id 블로그 글 ID
     * @returns {Promise<void>}
     */
    async delete(id) {
        const result = await this._delete(id);
        this.invalidateCache(id);
        return result;
    }
};
