const {
    executeQuery,
    executeQuerySingle,
    mapProjectListItem
} = require('./common');
const {
    appendProjectFilterConditions,
    buildProjectOrderClause,
    normalizeProjectFilters
} = require('./filters');

const PROJECT_TYPE_OPTIONS = [
    { value: 'web_app', label: 'Web App' },
    { value: 'admin_tool', label: 'Admin Tool' },
    { value: 'backend', label: 'Backend' },
    { value: 'fullstack', label: 'Full-stack' },
    { value: 'performance', label: 'Performance' },
    { value: 'case_study', label: 'Case Study' },
    { value: 'experiment', label: 'Experiment' },
    { value: 'other', label: 'Other' }
];

const PROJECT_STATUS_OPTIONS = [
    { value: 'planning', label: '기획 중' },
    { value: 'in_progress', label: '진행 중' },
    { value: 'completed', label: '완료' },
    { value: 'on_hold', label: '보류' },
    { value: 'archived', label: '보관됨' }
];

const PUBLICATION_STATUS_OPTIONS = [
    { value: 'published', label: '공개' },
    { value: 'draft', label: '비공개' },
    { value: 'all', label: '전체' }
];

const PROJECT_SORT_OPTIONS = [
    { value: 'catalog_priority', label: '추천순' },
    { value: 'created_at', label: '생성일순' },
    { value: 'published_at', label: '공개일순' },
    { value: 'title', label: '제목순' },
    { value: 'view_count', label: '조회순' },
    { value: 'display_order', label: '노출순' }
];

const PROJECT_CARD_SELECT = `
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
           (
               SELECT pi.image_url
               FROM project_images pi
               WHERE pi.project_id = p.id
               ORDER BY (pi.image_type = 'catalog') DESC, pi.is_primary DESC, pi.display_order ASC, pi.id ASC
               LIMIT 1
           ) AS primary_image_url,
           (
               SELECT pi.alt_text
               FROM project_images pi
               WHERE pi.project_id = p.id
               ORDER BY (pi.image_type = 'catalog') DESC, pi.is_primary DESC, pi.display_order ASC, pi.id ASC
               LIMIT 1
           ) AS primary_image_alt,
           (
               SELECT pl.url
               FROM project_links pl
               WHERE pl.project_id = p.id AND pl.link_type = 'demo'
               ORDER BY pl.is_primary DESC, pl.display_order ASC, pl.id ASC
               LIMIT 1
           ) AS demo_url,
           (
               SELECT pl.url
               FROM project_links pl
               WHERE pl.project_id = p.id AND pl.link_type = 'github'
               ORDER BY pl.is_primary DESC, pl.display_order ASC, pl.id ASC
               LIMIT 1
           ) AS github_url,
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
    FROM projects p
    LEFT JOIN project_catalog_profiles cp ON cp.project_id = p.id
`;

const buildSectionFallbackFilters = (section, limit) => {
    const baseFilters = {
        limit,
        offset: 0,
        status: 'published',
        published_only: true
    };

    if (section.section_type === 'featured') {
        return {
            ...baseFilters,
            featured: true,
            sort: 'catalog_priority',
            order: 'desc'
        };
    }

    if (section.section_type === 'new_arrivals') {
        return {
            ...baseFilters,
            sort: 'published_at',
            order: 'desc'
        };
    }

    if (section.section_type === 'popular') {
        return {
            ...baseFilters,
            sort: 'view_count',
            order: 'desc'
        };
    }

    if (section.section_type === 'case_study') {
        return {
            ...baseFilters,
            project_type: 'case_study',
            sort: 'catalog_priority',
            order: 'desc'
        };
    }

    return {
        ...baseFilters,
        sort: 'catalog_priority',
        order: 'desc'
    };
};

module.exports = {
    /**
     * @description 모든 프로젝트를 조회하고 연관된 스킬/태그/이미지 정보를 병합한다.
     * @param {?number} [limit=null] 조회할 최대 개수
     * @param {number} [offset=0] 조회 시작 오프셋
     * @returns {Promise<Array>} 프로젝트 목록
     */
    async getAll(limit = null, offset = 0) {
        const queryParams = [];
        let query = `${PROJECT_CARD_SELECT}
            ORDER BY p.is_featured DESC, cp.catalog_priority DESC, p.display_order ASC, COALESCE(p.published_at, p.created_at) DESC
        `;

        if (limit) {
            query += ` LIMIT ? OFFSET ?`;
            queryParams.push(limit, offset);
        }

        const projects = await executeQuery(query, queryParams);
        return projects.map(mapProjectListItem);
    },

    /**
     * @description 다양한 조건을 조합하여 프로젝트를 검색한다.
     * @param {Object} filters 필터 옵션
     * @returns {Promise<Array>} 필터링된 프로젝트 목록
     */
    async getWithFilters(filters = {}) {
        const normalizedFilters = normalizeProjectFilters(filters);
        const { queryParams, whereClause } = appendProjectFilterConditions(normalizedFilters);
        const orderClause = buildProjectOrderClause(normalizedFilters);

        const query = `${PROJECT_CARD_SELECT}
            ${whereClause}
            ${orderClause}
            LIMIT ? OFFSET ?
        `;

        queryParams.push(normalizedFilters.limit, normalizedFilters.offset);
        const projects = await executeQuery(query, queryParams);

        return projects.map(mapProjectListItem);
    },

    /**
     * @description 필터 조건에 맞는 프로젝트 총 개수를 반환한다.
     * @param {Object} filters 필터 옵션
     * @returns {Promise<number>} 프로젝트 총 개수
     */
    async getCountWithFilters(filters = {}) {
        const normalizedFilters = normalizeProjectFilters(filters);
        const { queryParams, whereClause } = appendProjectFilterConditions(normalizedFilters);

        const query = `
            SELECT COUNT(DISTINCT p.id) as total
            FROM projects p
            LEFT JOIN project_catalog_profiles cp ON cp.project_id = p.id
            ${whereClause}
        `;

        const result = await executeQuerySingle(query, queryParams);
        return result.total || 0;
    },

    /**
     * @description 추천 프로젝트 목록을 조회한다.
     * @param {number} [limit=5] 최대 조회 개수
     * @param {number} [offset=0] 시작 오프셋
     * @returns {Promise<Array>} 추천 프로젝트 목록
     */
    async getFeatured(limit = 5, offset = 0) {
        const query = `${PROJECT_CARD_SELECT}
            WHERE p.is_featured = 1 AND p.is_published = 1
            ORDER BY cp.catalog_priority DESC, p.display_order ASC, COALESCE(p.published_at, p.created_at) DESC
            LIMIT ? OFFSET ?
        `;

        const projects = await executeQuery(query, [limit, offset]);
        return projects.map(mapProjectListItem);
    },

    async getCatalogSectionItems(sectionId, limit = 4) {
        const query = `
            SELECT p.*,
                   cp.catalog_title,
                   COALESCE(csi.custom_summary, cp.catalog_summary) AS catalog_summary,
                   COALESCE(csi.custom_label, cp.catalog_label) AS catalog_label,
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
                   csi.custom_label,
                   csi.custom_summary,
                   csi.display_order AS section_display_order,
                   (
                       SELECT pi.image_url
                       FROM project_images pi
                       WHERE pi.project_id = p.id
                       ORDER BY (pi.image_type = 'catalog') DESC, pi.is_primary DESC, pi.display_order ASC, pi.id ASC
                       LIMIT 1
                   ) AS primary_image_url,
                   (
                       SELECT pi.alt_text
                       FROM project_images pi
                       WHERE pi.project_id = p.id
                       ORDER BY (pi.image_type = 'catalog') DESC, pi.is_primary DESC, pi.display_order ASC, pi.id ASC
                       LIMIT 1
                   ) AS primary_image_alt,
                   (
                       SELECT pl.url
                       FROM project_links pl
                       WHERE pl.project_id = p.id AND pl.link_type = 'demo'
                       ORDER BY pl.is_primary DESC, pl.display_order ASC, pl.id ASC
                       LIMIT 1
                   ) AS demo_url,
                   (
                       SELECT pl.url
                       FROM project_links pl
                       WHERE pl.project_id = p.id AND pl.link_type = 'github'
                       ORDER BY pl.is_primary DESC, pl.display_order ASC, pl.id ASC
                       LIMIT 1
                   ) AS github_url,
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
            FROM project_catalog_section_items csi
            INNER JOIN projects p ON p.id = csi.project_id
            LEFT JOIN project_catalog_profiles cp ON cp.project_id = p.id
            WHERE csi.section_id = ? AND p.is_published = 1
            ORDER BY csi.display_order ASC, cp.catalog_priority DESC, p.display_order ASC, COALESCE(p.published_at, p.created_at) DESC
            LIMIT ?
        `;

        const projects = await executeQuery(query, [sectionId, limit]);
        return projects.map(mapProjectListItem);
    },

    async getCatalogSectionItemCount(sectionId) {
        const result = await executeQuerySingle(`
            SELECT COUNT(DISTINCT p.id) AS total
            FROM project_catalog_section_items csi
            INNER JOIN projects p ON p.id = csi.project_id
            WHERE csi.section_id = ? AND p.is_published = 1
        `, [sectionId]);

        return result?.total || 0;
    },

    async getCatalogSections(limit = 4) {
        const sections = await executeQuery(`
            SELECT *
            FROM project_catalog_sections
            WHERE is_active = 1
            ORDER BY display_order ASC, id ASC
        `);

        return await Promise.all(sections.map(async (section) => {
            const explicitTotal = await this.getCatalogSectionItemCount(section.id);
            if (explicitTotal > 0) {
                const items = await this.getCatalogSectionItems(section.id, limit);
                return {
                    id: section.id,
                    title: section.name,
                    name: section.name,
                    slug: section.slug,
                    description: section.description,
                    type: section.section_type,
                    display_order: section.display_order,
                    items,
                    total: explicitTotal
                };
            }

            const filters = buildSectionFallbackFilters(section, limit);
            const [items, total] = await Promise.all([
                this.getWithFilters(filters),
                this.getCountWithFilters(filters)
            ]);

            return {
                id: section.id,
                title: section.name,
                name: section.name,
                slug: section.slug,
                description: section.description,
                type: section.section_type,
                display_order: section.display_order,
                items,
                total
            };
        }));
    },

    async getFilterOptions() {
        const [skills, tags] = await Promise.all([
            executeQuery(`
                SELECT DISTINCT s.id,
                       s.name,
                       s.slug,
                       s.description,
                       s.proficiency_level,
                       s.icon,
                       s.color,
                       s.display_order,
                       s.is_featured,
                       sc.name AS category_name,
                       sc.slug AS category_slug
                FROM skills s
                INNER JOIN project_skills ps ON ps.skill_id = s.id
                INNER JOIN projects p ON p.id = ps.project_id
                LEFT JOIN skill_categories sc ON sc.id = s.category_id
                WHERE p.is_published = 1
                ORDER BY s.is_featured DESC, s.display_order ASC, s.name ASC
            `),
            executeQuery(`
                SELECT DISTINCT t.id,
                       t.name,
                       t.slug,
                       t.description,
                       t.color,
                       t.type,
                       t.usage_count
                FROM tags t
                INNER JOIN project_tags pt ON pt.tag_id = t.id
                INNER JOIN projects p ON p.id = pt.project_id
                WHERE p.is_published = 1
                ORDER BY t.usage_count DESC, t.name ASC
            `)
        ]);

        return {
            projectTypes: PROJECT_TYPE_OPTIONS,
            projectStatuses: PROJECT_STATUS_OPTIONS,
            publicationStatuses: PUBLICATION_STATUS_OPTIONS,
            sortOptions: PROJECT_SORT_OPTIONS,
            skills,
            tags
        };
    },

    async getRelatedProjects(slug, limit = 4) {
        const project = await executeQuerySingle(`
            SELECT id, project_type
            FROM projects
            WHERE slug = ? AND is_published = 1
            LIMIT 1
        `, [slug]);

        if (!project) {
            return null;
        }

        const query = `${PROJECT_CARD_SELECT}
            WHERE p.is_published = 1 AND p.id <> ?
            ORDER BY
                (p.project_type = ?) DESC,
                (
                    SELECT COUNT(*)
                    FROM project_skills target_ps
                    INNER JOIN project_skills candidate_ps ON candidate_ps.skill_id = target_ps.skill_id
                    WHERE target_ps.project_id = ? AND candidate_ps.project_id = p.id
                ) DESC,
                (
                    SELECT COUNT(*)
                    FROM project_tags target_pt
                    INNER JOIN project_tags candidate_pt ON candidate_pt.tag_id = target_pt.tag_id
                    WHERE target_pt.project_id = ? AND candidate_pt.project_id = p.id
                ) DESC,
                cp.catalog_priority DESC,
                p.view_count DESC,
                p.display_order ASC,
                COALESCE(p.published_at, p.created_at) DESC
            LIMIT ?
        `;

        const projects = await executeQuery(query, [
            project.id,
            project.project_type,
            project.id,
            project.id,
            limit
        ]);

        return projects.map(mapProjectListItem);
    },

    async getRecommendations(limit = 8) {
        const query = `${PROJECT_CARD_SELECT}
            WHERE p.is_published = 1
            ORDER BY
                p.is_featured DESC,
                (p.project_type = 'case_study') DESC,
                cp.catalog_priority DESC,
                p.view_count DESC,
                COALESCE(p.published_at, p.created_at) DESC,
                p.display_order ASC
            LIMIT ?
        `;

        const projects = await executeQuery(query, [limit]);
        return projects.map(mapProjectListItem);
    }
};
export {};
