const {
    executeQuery,
    executeQuerySingle,
    mapProjectDetailItem
} = require('./common');
const {
    getRelatedPostsForProject
} = require('../blog-posts/projects');

const getProjectRelations = async (id) => {
    return await Promise.all([
        executeQuery(`
            SELECT s.*,
                   sc.name AS category_name,
                   sc.slug AS category_slug,
                   ps.importance,
                   ps.display_order AS project_display_order
            FROM skills s
            INNER JOIN project_skills ps ON s.id = ps.skill_id
            LEFT JOIN skill_categories sc ON sc.id = s.category_id
            WHERE ps.project_id = ?
            ORDER BY ps.display_order ASC, s.name ASC
        `, [id]),
        executeQuery(`
            SELECT * FROM project_images
            WHERE project_id = ?
            ORDER BY (image_type = 'catalog') DESC, is_primary DESC, display_order ASC, id ASC
        `, [id]),
        executeQuery(`
            SELECT t.* FROM tags t
            INNER JOIN project_tags pt ON t.id = pt.tag_id
            WHERE pt.project_id = ?
            ORDER BY t.name ASC
        `, [id]),
        executeQuery(`
            SELECT *
            FROM project_metrics
            WHERE project_id = ?
            ORDER BY is_highlighted DESC, display_order ASC, id ASC
        `, [id]),
        executeQuery(`
            SELECT *
            FROM project_links
            WHERE project_id = ?
            ORDER BY is_primary DESC, display_order ASC, id ASC
        `, [id]),
        executeQuery(`
            SELECT pcs.*,
                   csi.display_order AS section_item_order,
                   csi.custom_label,
                   csi.custom_summary
            FROM project_catalog_sections pcs
            INNER JOIN project_catalog_section_items csi ON csi.section_id = pcs.id
            WHERE csi.project_id = ?
            ORDER BY pcs.display_order ASC, csi.display_order ASC
        `, [id]),
        getRelatedPostsForProject(id)
    ]);
};

const projectDetailSelect = `
    SELECT p.*,
           cp.catalog_title,
           cp.catalog_summary,
           cp.catalog_label,
           cp.catalog_status,
           cp.catalog_badge,
           cp.catalog_image_url,
           cp.catalog_accent_color,
           cp.catalog_cta_label,
           cp.catalog_priority,
           cp.price_label,
           cp.difficulty_label,
           cp.impact_summary,
           cp.primary_metric_label,
           cp.primary_metric_value
    FROM projects p
    LEFT JOIN project_catalog_profiles cp ON cp.project_id = p.id
`;

module.exports = {
    /**
     * @description ID 기반으로 프로젝트 상세 정보를 조회한다.
     * @param {number} id 프로젝트 ID
     * @returns {Promise<Object|null>} 프로젝트 정보 또는 null
     */
    async getById(id) {
        const project = await executeQuerySingle(`${projectDetailSelect} WHERE p.id = ?`, [id]);

        if (!project) return null;

        const [skills, images, tags, metrics, links, sections, relatedPosts] = await getProjectRelations(id);

        return mapProjectDetailItem(project, {
            skills,
            images,
            tags,
            metrics,
            links,
            sections,
            related_posts: relatedPosts
        });
    },

    /**
     * @description 슬러그 기반으로 프로젝트 상세 정보를 조회한다.
     * @param {string} slug 프로젝트 슬러그
     * @returns {Promise<Object|null>} 프로젝트 정보 또는 null
     */
    async getBySlug(slug) {
        const project = await executeQuerySingle(`${projectDetailSelect} WHERE p.slug = ?`, [slug]);

        if (!project) return null;

        const [skills, images, tags, metrics, links, sections, relatedPosts] = await getProjectRelations(project.id);

        return mapProjectDetailItem(project, {
            skills,
            images,
            tags,
            metrics,
            links,
            sections,
            related_posts: relatedPosts
        });
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
export {};
