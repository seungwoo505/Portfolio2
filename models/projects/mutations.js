const {
    createQueryContext,
    createUniqueSlug,
    executeTransaction,
    hasOwn,
    normalizeOptionalUrl,
    toCsvStringArray
} = require('./common');

module.exports = {
    /**
     * @description 새 프로젝트를 생성하고 생성된 ID를 반환한다.
     * @param {Object} data 프로젝트 데이터
     * @returns {Promise<number>} 신규 프로젝트 ID
     */
    async create(data) {
        const { title, slug: providedSlug, description, detailed_description, content, excerpt, meta_description, thumbnail_image, featured_image, demo_url, project_url, github_url, start_date, end_date, is_ongoing, status, is_featured, is_published, display_order, meta_keywords, tags } = data;
        const finalDemoUrl = demo_url || project_url;

        return await executeTransaction(async (connection) => {
            const db = createQueryContext(connection);
            const slug = await createUniqueSlug({
                value: title,
                providedSlug,
                fallback: 'project',
                maxLength: 255,
                exists: async candidate => !!(await db.querySingle(
                    'SELECT id FROM projects WHERE slug = ? LIMIT 1',
                    [candidate]
                ))
            });

            const sanitizedData = [
                title || null,
                slug || null,
                description || null,
                detailed_description || null,
                content || null,
                excerpt || null,
                meta_description || null,
                thumbnail_image || null,
                featured_image || null,
                finalDemoUrl || null,
                github_url || null,
                start_date || null,
                end_date || null,
                is_ongoing || false,
                status || 'completed',
                is_featured || false,
                is_published || false,
                display_order || 0,
                meta_keywords || null
            ];

            const query = `
                INSERT INTO projects (title, slug, description, detailed_description, content, excerpt, meta_description, thumbnail_image, featured_image, demo_url, github_url, start_date, end_date, is_ongoing, status, is_featured, is_published, display_order, meta_keywords)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `;
            const result = await db.query(query, sanitizedData);
            const projectId = result.insertId;

            const normalizedTags = toCsvStringArray(tags);
            if (normalizedTags.length > 0) {
                await this.updateTags(projectId, normalizedTags, db);
            }

            return projectId;
        });
    },

    /**
     * @description 프로젝트 레코드를 업데이트하고 최신 데이터를 반환한다.
     * @param {number} id 수정할 프로젝트 ID
     * @param {Object} data 업데이트할 필드 값
     * @returns {Promise<Object>} 갱신된 프로젝트 정보
     */
    async update(id, data) {
        const { title, slug: providedSlug, description, detailed_description, content, excerpt, meta_description, thumbnail_image, featured_image, demo_url, project_url, github_url, start_date, end_date, is_ongoing, status, is_featured, is_published, display_order, meta_keywords, tags } = data;
        const finalDemoUrl = hasOwn(data, 'demo_url')
            ? demo_url
            : (hasOwn(data, 'project_url') ? project_url : undefined);

        await executeTransaction(async (connection) => {
            const db = createQueryContext(connection);
            let slug = null;

            if (providedSlug !== undefined || title !== undefined) {
                slug = await createUniqueSlug({
                    value: title,
                    providedSlug,
                    fallback: 'project',
                    maxLength: 255,
                    exists: async candidate => !!(await db.querySingle(
                        'SELECT id FROM projects WHERE slug = ? AND id != ? LIMIT 1',
                        [candidate, id]
                    ))
                });
            }

            const updateFields = [];
            const updateValues = [];

            if (title !== undefined) {
                updateFields.push('title = ?');
                updateValues.push(title);
            }
            if (providedSlug !== undefined || title !== undefined) {
                updateFields.push('slug = ?');
                updateValues.push(slug);
            }
            if (description !== undefined) updateFields.push('description = ?'), updateValues.push(description);
            if (detailed_description !== undefined) updateFields.push('detailed_description = ?'), updateValues.push(detailed_description);
            if (content !== undefined) updateFields.push('content = ?'), updateValues.push(content);
            if (excerpt !== undefined) updateFields.push('excerpt = ?'), updateValues.push(excerpt);
            if (meta_description !== undefined) updateFields.push('meta_description = ?'), updateValues.push(meta_description);
            if (thumbnail_image !== undefined) updateFields.push('thumbnail_image = ?'), updateValues.push(thumbnail_image);
            if (featured_image !== undefined) updateFields.push('featured_image = ?'), updateValues.push(featured_image);
            if (finalDemoUrl !== undefined) updateFields.push('demo_url = ?'), updateValues.push(normalizeOptionalUrl(finalDemoUrl));
            if (github_url !== undefined) updateFields.push('github_url = ?'), updateValues.push(github_url);
            if (start_date !== undefined) updateFields.push('start_date = ?'), updateValues.push(start_date);
            if (end_date !== undefined) updateFields.push('end_date = ?'), updateValues.push(end_date);
            if (is_ongoing !== undefined) updateFields.push('is_ongoing = ?'), updateValues.push(is_ongoing);
            if (status !== undefined) updateFields.push('status = ?'), updateValues.push(status);
            if (is_featured !== undefined) {
                updateFields.push('is_featured = ?'), updateValues.push(is_featured);
            }
            if (is_published !== undefined) updateFields.push('is_published = ?'), updateValues.push(is_published);
            if (display_order !== undefined) updateFields.push('display_order = ?'), updateValues.push(display_order);
            if (meta_keywords !== undefined) updateFields.push('meta_keywords = ?'), updateValues.push(meta_keywords);

            if (updateFields.length > 0) {
                updateFields.push('updated_at = NOW()');

                const query = `UPDATE projects SET ${updateFields.join(', ')} WHERE id = ?`;
                updateValues.push(id);

                await db.query(query, updateValues);
            }

            if (hasOwn(data, 'tags')) {
                await this.updateTags(id, tags, db);
            }
        });

        return await this.getById(id);
    },

    /**
     * @description 프로젝트와 연관된 하위 데이터를 모두 삭제한다.
     * @param {number} id 삭제할 프로젝트 ID
     * @returns {Promise<void>}
     */
    async delete(id) {
        await executeTransaction(async (connection) => {
            const db = createQueryContext(connection);

            await db.query('DELETE FROM project_skills WHERE project_id = ?', [id]);
            await db.query('DELETE FROM project_images WHERE project_id = ?', [id]);
            await db.query("DELETE FROM tag_usage WHERE content_type = 'project' AND content_id = ?", [id]);
            await db.query('DELETE FROM projects WHERE id = ?', [id]);
            await db.query('UPDATE tags t LEFT JOIN (SELECT tag_id, COUNT(*) cnt FROM tag_usage GROUP BY tag_id) u ON t.id = u.tag_id SET t.usage_count = COALESCE(u.cnt, 0)');
        });
    }
};
