const {
    executeQuery,
    executeQuerySingle,
    mapProjectListItems
} = require('./common');
const {
    appendProjectFilterConditions,
    buildProjectOrderClause,
    normalizeProjectFilters
} = require('./filters');

module.exports = {
    /**
     * @description 모든 프로젝트를 조회하고 연관된 스킬/태그/이미지 정보를 병합한다.
     * @param {?number} [limit=null] 조회할 최대 개수
     * @param {number} [offset=0] 조회 시작 오프셋
     * @returns {Promise<Array>} 프로젝트 목록
     */
    async getAll(limit = null, offset = 0) {
        const queryParams = [];
        let query = `
            SELECT p.*
            FROM projects p
            ORDER BY p.is_featured DESC, p.display_order ASC, p.created_at DESC
        `;

        if (limit) {
            query += ` LIMIT ? OFFSET ?`;
            queryParams.push(limit, offset);
        }

        const projects = await executeQuery(query, queryParams);
        return await mapProjectListItems(projects);
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

        const query = `
            SELECT p.*
            FROM projects p
            ${whereClause}
            ${orderClause}
            LIMIT ? OFFSET ?
        `;

        queryParams.push(normalizedFilters.limit, normalizedFilters.offset);
        const projects = await executeQuery(query, queryParams);

        return await mapProjectListItems(projects);
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
            LEFT JOIN project_skills ps ON p.id = ps.project_id
            LEFT JOIN skills s ON ps.skill_id = s.id
            LEFT JOIN tag_usage tu ON tu.content_type = 'project' AND tu.content_id = p.id
            LEFT JOIN tags t ON t.id = tu.tag_id
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
        const query = `
            SELECT p.*
            FROM projects p
            WHERE p.is_featured = 1 AND p.is_published = 1
            ORDER BY p.display_order ASC, p.created_at DESC
            LIMIT ? OFFSET ?
        `;

        const projects = await executeQuery(query, [limit, offset]);
        return await mapProjectListItems(projects);
    }
};
export {};
