const {
    executeQuery,
    executeQuerySingle
} = require('./common');

const getProjectRelations = async (id) => {
    return await Promise.all([
        executeQuery(`
            SELECT s.* FROM skills s
            INNER JOIN project_skills ps ON s.id = ps.skill_id
            WHERE ps.project_id = ?
            ORDER BY s.name ASC
        `, [id]),
        executeQuery(`
            SELECT * FROM project_images
            WHERE project_id = ?
            ORDER BY display_order ASC
        `, [id]),
        executeQuery(`
            SELECT t.* FROM tags t
            INNER JOIN tag_usage tu ON t.id = tu.tag_id
            WHERE tu.content_type = 'project' AND tu.content_id = ?
            ORDER BY t.name ASC
        `, [id])
    ]);
};

module.exports = {
    /**
     * @description ID 기반으로 프로젝트 상세 정보를 조회한다.
     * @param {number} id 프로젝트 ID
     * @returns {Promise<Object|null>} 프로젝트 정보 또는 null
     */
    async getById(id) {
        const project = await executeQuerySingle(`
            SELECT * FROM projects WHERE id = ?
        `, [id]);

        if (!project) return null;

        const [skills, images, tags] = await getProjectRelations(id);

        return {
            ...project,
            featured: Boolean(project.is_featured),
            skills,
            images,
            tags
        };
    },

    /**
     * @description 슬러그 기반으로 프로젝트 상세 정보를 조회한다.
     * @param {string} slug 프로젝트 슬러그
     * @returns {Promise<Object|null>} 프로젝트 정보 또는 null
     */
    async getBySlug(slug) {
        const project = await executeQuerySingle(`
            SELECT * FROM projects WHERE slug = ?
        `, [slug]);

        if (!project) return null;

        const [skills, images, tags] = await getProjectRelations(project.id);

        return {
            ...project,
            featured: Boolean(project.is_featured),
            long_description: project.content_text || project.content || project.detailed_description,
            skills,
            images,
            tags
        };
    },

    /**
     * @description 프로젝트 조회수를 1 증가시킨다.
     * @param {number} id 프로젝트 ID
     * @returns {Promise<void>}
     */
    async incrementView(id) {
        await executeQuery('UPDATE projects SET view_count = view_count + 1 WHERE id = ?', [id]);
    }
};
