const {
    createUniqueSlug,
    defaultQueryContext,
    executeQuery,
    generateSlug,
    toCsvStringArray
} = require('./common');

const normalizeRelationItemName = (item) => {
    if (typeof item === 'string') {
        return item.trim();
    }

    if (item && typeof item === 'object') {
        return String(item.name || item.label || '').trim();
    }

    return '';
};

module.exports = {
    /**
     * @description 프로젝트에 스킬 관계를 추가한다.
     * @param {number} projectId 프로젝트 ID
     * @param {number} skillId 스킬 ID
     * @returns {Promise<void>}
     */
    async addSkill(projectId, skillId, importance = 'secondary', displayOrder = 0) {
        const query = `
            INSERT IGNORE INTO project_skills (project_id, skill_id, importance, display_order)
            VALUES (?, ?, ?, ?)
        `;
        await executeQuery(query, [projectId, skillId, importance, displayOrder]);
    },

    /**
     * @description 프로젝트에서 스킬 관계를 제거한다.
     * @param {number} projectId 프로젝트 ID
     * @param {number} skillId 스킬 ID
     * @returns {Promise<void>}
     */
    async removeSkill(projectId, skillId) {
        await executeQuery('DELETE FROM project_skills WHERE project_id = ? AND skill_id = ?', [projectId, skillId]);
    },

    /**
     * @description 프로젝트에 이미지를 추가한다.
     * @param {number} projectId 프로젝트 ID
     * @param {string} imageUrl 이미지 URL
     * @param {?string} [altText=null] 대체 텍스트
     * @param {number} [displayOrder=0] 노출 순서
     * @returns {Promise<number>} 생성된 이미지 ID
     */
    async addImage(projectId, imageUrl, altText = null, displayOrder = 0, imageType = 'gallery') {
        const query = `
            INSERT INTO project_images (project_id, image_type, image_url, alt_text, display_order)
            VALUES (?, ?, ?, ?, ?)
        `;
        const result = await executeQuery(query, [projectId, imageType, imageUrl, altText, displayOrder]);
        return result.insertId;
    },

    /**
     * @description 프로젝트 이미지 레코드를 제거한다.
     * @param {number} imageId 이미지 ID
     * @returns {Promise<void>}
     */
    async removeImage(imageId) {
        await executeQuery('DELETE FROM project_images WHERE id = ?', [imageId]);
    },

    /**
     * @description 프로젝트 이미지 노출 순서를 갱신한다.
     * @param {number} imageId 이미지 ID
     * @param {number} displayOrder 변경할 순서
     * @returns {Promise<void>}
     */
    async updateImageOrder(imageId, displayOrder) {
        await executeQuery('UPDATE project_images SET display_order = ? WHERE id = ?', [displayOrder, imageId]);
    },

    /**
     * @description 프로젝트에 연결된 태그 정보를 재생성한다.
     * @param {number} projectId 프로젝트 ID
     * @param {Array<string>} tagNames 태그 이름 목록
     * @returns {Promise<void>}
     */
    async updateTags(projectId, tagNames, db = defaultQueryContext) {
        await db.query('DELETE FROM project_tags WHERE project_id = ?', [projectId]);
        const tagArray = toCsvStringArray(tagNames);

        for (const tagName of tagArray) {
            const trimmed = String(tagName).trim();
            if (!trimmed) continue;
            let tag = await db.querySingle('SELECT id FROM tags WHERE name = ?', [trimmed]);
            if (!tag) {
                const tagSlug = await createUniqueSlug({
                    value: trimmed,
                    fallback: 'tag',
                    maxLength: 120,
                    exists: async candidate => !!(await db.querySingle(
                        'SELECT id FROM tags WHERE slug = ? LIMIT 1',
                        [candidate]
                    ))
                });
                const result = await db.query("INSERT INTO tags (name, slug, type) VALUES (?, ?, 'project')", [trimmed, tagSlug]);
                tag = { id: result.insertId };
            }
            await db.query('INSERT IGNORE INTO project_tags (project_id, tag_id) VALUES (?, ?)', [projectId, tag.id]);
        }
        await db.query('UPDATE tags t LEFT JOIN (SELECT tag_id, COUNT(*) cnt FROM project_tags GROUP BY tag_id) u ON t.id = u.tag_id SET t.usage_count = COALESCE(u.cnt, 0)');
    },

    async updateSkills(projectId, skills, db = defaultQueryContext) {
        await db.query('DELETE FROM project_skills WHERE project_id = ?', [projectId]);
        const skillItems = Array.isArray(skills) ? skills : toCsvStringArray(skills);

        for (const [index, skillItem] of skillItems.entries()) {
            const name = normalizeRelationItemName(skillItem);
            if (!name) continue;
            const importance = typeof skillItem === 'object' && skillItem?.importance
                ? skillItem.importance
                : 'secondary';
            const displayOrder = typeof skillItem === 'object' && Number.isFinite(Number(skillItem?.display_order))
                ? Number(skillItem.display_order)
                : index;
            let skill = await db.querySingle('SELECT id FROM skills WHERE name = ? OR slug = ? LIMIT 1', [name, generateSlug(name, 'skill')]);

            if (!skill) {
                const skillSlug = await createUniqueSlug({
                    value: name,
                    fallback: 'skill',
                    maxLength: 120,
                    exists: async candidate => !!(await db.querySingle(
                        'SELECT id FROM skills WHERE slug = ? LIMIT 1',
                        [candidate]
                    ))
                });
                const result = await db.query('INSERT INTO skills (name, slug, display_order) VALUES (?, ?, ?)', [name, skillSlug, displayOrder]);
                skill = { id: result.insertId };
            }

            await db.query(
                'INSERT IGNORE INTO project_skills (project_id, skill_id, importance, display_order) VALUES (?, ?, ?, ?)',
                [projectId, skill.id, importance, displayOrder]
            );
        }
    }
};
export {};
