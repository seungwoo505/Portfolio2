const {
    defaultQueryContext,
    executeQuery,
    normalizeTagNames
} = require('./common');
const {
    mapProjectListItem
} = require('../projects/common');

const normalizeRelatedProjects = (projects) => {
    if (!projects) {
        return [];
    }

    const values = Array.isArray(projects) ? projects : String(projects).split(',');
    return values
        .map((item, index) => {
            if (typeof item === 'number' || typeof item === 'string') {
                const value = String(item).trim();
                return value ? {
                    project_id: /^\d+$/.test(value) ? Number(value) : null,
                    slug: /^\d+$/.test(value) ? null : value,
                    display_order: index,
                    relation_label: null
                } : null;
            }

            if (item && typeof item === 'object') {
                const rawId = item.project_id ?? item.id;
                const rawSlug = item.slug;
                return {
                    project_id: rawId && /^\d+$/.test(String(rawId)) ? Number(rawId) : null,
                    slug: typeof rawSlug === 'string' && rawSlug.trim() ? rawSlug.trim() : null,
                    display_order: Number.isInteger(Number(item.display_order)) ? Number(item.display_order) : index,
                    relation_label: typeof item.relation_label === 'string' && item.relation_label.trim()
                        ? item.relation_label.trim()
                        : null
                };
            }

            return null;
        })
        .filter(Boolean);
};

const findProjectId = async (project, db) => {
    if (project.project_id) {
        const existing = await db.querySingle('SELECT id FROM projects WHERE id = ? LIMIT 1', [project.project_id]);
        return existing?.id || null;
    }

    if (project.slug) {
        const existing = await db.querySingle('SELECT id FROM projects WHERE slug = ? LIMIT 1', [project.slug]);
        return existing?.id || null;
    }

    return null;
};

module.exports = {
    normalizeRelatedProjects,

    async updateProjects(postId, projects, db = defaultQueryContext) {
        await db.query('DELETE FROM blog_project_links WHERE blog_post_id = ?', [postId]);

        for (const project of normalizeRelatedProjects(projects)) {
            const projectId = await findProjectId(project, db);
            if (!projectId) {
                continue;
            }

            await db.query(`
                INSERT INTO blog_project_links (
                    blog_post_id,
                    project_id,
                    display_order,
                    relation_label
                ) VALUES (?, ?, ?, ?)
            `, [
                postId,
                projectId,
                project.display_order,
                project.relation_label
            ]);
        }
    },

    async getRelatedProjects(postId) {
        const projects = await executeQuery(`
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
                   cp.primary_metric_value,
                   bpl.relation_label,
                   bpl.display_order AS relation_display_order,
                   (
                       SELECT pi.image_url
                       FROM project_images pi
                       WHERE pi.project_id = p.id
                       ORDER BY (pi.image_type = 'catalog') DESC, pi.is_primary DESC, pi.display_order ASC, pi.id ASC
                       LIMIT 1
                   ) AS primary_image_url,
                   (
                       SELECT GROUP_CONCAT(DISTINCT t.name ORDER BY t.name ASC SEPARATOR ',')
                       FROM project_tags pt
                       INNER JOIN tags t ON t.id = pt.tag_id
                       WHERE pt.project_id = p.id
                   ) AS tags,
                   (
                       SELECT GROUP_CONCAT(DISTINCT s.name ORDER BY ps.display_order ASC, s.name ASC SEPARATOR ',')
                       FROM project_skills ps
                       INNER JOIN skills s ON s.id = ps.skill_id
                       WHERE ps.project_id = p.id
                   ) AS skills
            FROM blog_project_links bpl
            INNER JOIN projects p ON p.id = bpl.project_id
            LEFT JOIN project_catalog_profiles cp ON cp.project_id = p.id
            WHERE bpl.blog_post_id = ? AND p.is_published = 1
            ORDER BY bpl.display_order ASC, cp.catalog_priority DESC, p.title ASC
        `, [postId]);

        return projects.map(mapProjectListItem);
    },

    async getRelatedPostsForProject(projectId) {
        const posts = await executeQuery(`
            SELECT bp.*,
                   bpl.relation_label,
                   bpl.display_order AS relation_display_order,
                   GROUP_CONCAT(DISTINCT t.name ORDER BY t.name ASC) as tags
            FROM blog_project_links bpl
            INNER JOIN blog_posts bp ON bp.id = bpl.blog_post_id
            LEFT JOIN tag_usage tu ON tu.content_type = 'blog_post' AND tu.content_id = bp.id
            LEFT JOIN tags t ON tu.tag_id = t.id
            WHERE bpl.project_id = ? AND bp.is_published = TRUE
            GROUP BY bp.id, bpl.relation_label, bpl.display_order
            ORDER BY bpl.display_order ASC, bp.published_at DESC, bp.created_at DESC
        `, [projectId]);

        return posts.map((post) => ({
            ...post,
            featured: Boolean(post.is_featured),
            tags: normalizeTagNames(post.tags).map((tag) => String(tag).trim()).filter(Boolean)
        }));
    }
};

export {};
