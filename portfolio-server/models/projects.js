const { executeQuery, executeQuerySingle } = require('./db-utils');
const CacheUtils = require('../utils/cache');

const Projects = {
    /**
     * @description 프로젝트 제목을 기반으로 URL 슬러그를 생성한다.
     * @param {string} title 생성할 프로젝트 제목
     * @returns {string} 정규화된 슬러그
     */
    generateSlug(title) {
        return title
            .toLowerCase()
            .replace(/[^a-z0-9가-힣\s-]/g, '') // 한글, 영문, 숫자, 공백, 하이픈만 허용
            .replace(/\s+/g, '-') // 공백을 하이픈으로 변환
            .replace(/-+/g, '-') // 연속된 하이픈을 하나로
            .trim('-'); // 앞뒤 하이픈 제거
    },
    /**
     * @description 모든 프로젝트를 조회하고 연관된 스킬/태그/이미지 정보를 병합한다.
     * @param {?number} [limit=null] 조회할 최대 개수
     * @param {number} [offset=0] 조회 시작 오프셋
     * @returns {Promise<Array>} 프로젝트 목록
     */
    async getAll(limit = null, offset = 0) {
        return await (async () => {
            let query = `
                SELECT p.*, 
                       GROUP_CONCAT(DISTINCT s.name ORDER BY s.name ASC) as skills,
                       GROUP_CONCAT(DISTINCT t.name ORDER BY t.name ASC) as tags,
                       GROUP_CONCAT(DISTINCT pi.image_url ORDER BY pi.display_order ASC) as images
                FROM projects p
                LEFT JOIN project_skills ps ON p.id = ps.project_id
                LEFT JOIN skills s ON ps.skill_id = s.id
                LEFT JOIN tag_usage tu ON tu.content_type = 'project' AND tu.content_id = p.id
                LEFT JOIN tags t ON t.id = tu.tag_id
                LEFT JOIN project_images pi ON p.id = pi.project_id
                GROUP BY p.id
                ORDER BY p.is_featured DESC, p.display_order ASC, p.created_at DESC
            `;
            
            if (limit) {
                query += ` LIMIT ${limit} OFFSET ${offset}`;
            }
            
            const projects = await executeQuery(query);
            
            const mappedProjects = projects.map(project => ({
                ...project,
                featured: Boolean(project.is_featured), // is_featured를 boolean으로 변환
                long_description: project.content || project.detailed_description, // content 우선, 없으면 detailed_description
                skills: project.skills ? project.skills.split(',') : [],
                tags: project.tags ? project.tags.split(',') : [],
                images: project.images ? project.images.split(',') : []
            }));
            
            return mappedProjects;
        })();
    },

    /**
     * @description 다양한 조건을 조합하여 프로젝트를 검색한다.
     * @param {Object} filters 필터 옵션
     * @param {?number} [filters.limit=10] 페이지당 개수
     * @param {number} [filters.offset=0] 시작 오프셋
     * @param {string} [filters.search] 검색어
     * @param {string[]} [filters.tags] 태그 슬러그 배열
     * @param {string[]} [filters.skills] 스킬 이름 배열
     * @param {?boolean} [filters.featured=null] 추천 여부
     * @param {('published'|'draft'|'all')} [filters.status='published'] 게시 상태
     * @param {('created_at'|'title'|'view_count'|'display_order')} [filters.sort='created_at'] 정렬 기준
     * @param {('asc'|'desc')} [filters.order='desc'] 정렬 방향
     * @param {boolean} [filters.published_only=true] 게시된 항목만 포함할지 여부
     * @returns {Promise<Array>} 필터링된 프로젝트 목록
     */
    async getWithFilters(filters = {}) {
        const {
            limit = 10,
            offset = 0,
            search = '',
            tags = [],
            skills = [],
            featured = null,
            status = 'published', // 'published', 'draft', 'all'
            sort = 'created_at', // 'created_at', 'title', 'view_count', 'display_order'
            order = 'desc', // 'asc', 'desc'
            published_only = true
        } = filters;

        let whereConditions = [];
        let queryParams = [];

        if (status === 'published') {
            whereConditions.push('p.is_published = 1');
        } else if (status === 'draft') {
            whereConditions.push('p.is_published = 0');
        } else if (published_only) {
            whereConditions.push('p.is_published = 1');
        }

        if (featured !== null) {
            whereConditions.push('p.is_featured = ?');
            queryParams.push(featured ? 1 : 0);
        }

        if (tags && tags.length > 0) {
            const tagPlaceholders = tags.map(() => '?').join(',');
            whereConditions.push(`
                p.id IN (
                    SELECT tu.content_id 
                    FROM tag_usage tu 
                    INNER JOIN tags t ON tu.tag_id = t.id 
                    WHERE tu.content_type = 'project' 
                    AND t.slug IN (${tagPlaceholders})
                )
            `);
            queryParams.push(...tags);
        }

        if (skills && skills.length > 0) {
            const skillPlaceholders = skills.map(() => '?').join(',');
            whereConditions.push(`
                p.id IN (
                    SELECT ps.project_id 
                    FROM project_skills ps 
                    INNER JOIN skills s ON ps.skill_id = s.id 
                    WHERE s.name IN (${skillPlaceholders})
                )
            `);
            queryParams.push(...skills);
        }

        if (search && search.trim()) {
            const searchTerm = `%${search.trim()}%`;
            whereConditions.push(`(
                p.title LIKE ? OR 
                p.short_description LIKE ? OR 
                p.detailed_description LIKE ? OR
                p.content LIKE ? OR
                p.technologies LIKE ?
            )`);
            queryParams.push(searchTerm, searchTerm, searchTerm, searchTerm, searchTerm);
        }

        const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';

        let orderClause = '';
        const validSortFields = ['created_at', 'title', 'view_count', 'display_order'];
        const validOrders = ['asc', 'desc'];
        
        const sortField = validSortFields.includes(sort) ? sort : 'created_at';
        const sortOrder = validOrders.includes(order.toLowerCase()) ? order.toUpperCase() : 'DESC';
        
        if (sortField === 'display_order') {
            orderClause = `ORDER BY p.is_featured DESC, p.display_order ASC, p.created_at DESC`;
        } else {
            orderClause = `ORDER BY p.is_featured DESC, p.${sortField} ${sortOrder}`;
        }

        const query = `
            SELECT p.*, 
                   GROUP_CONCAT(DISTINCT s.name ORDER BY s.name ASC) as skills,
                   GROUP_CONCAT(DISTINCT t.name ORDER BY t.name ASC) as tags,
                   GROUP_CONCAT(DISTINCT pi.image_url ORDER BY pi.display_order ASC) as images
            FROM projects p
            LEFT JOIN project_skills ps ON p.id = ps.project_id
            LEFT JOIN skills s ON ps.skill_id = s.id
            LEFT JOIN tag_usage tu ON tu.content_type = 'project' AND tu.content_id = p.id
            LEFT JOIN tags t ON t.id = tu.tag_id
            LEFT JOIN project_images pi ON p.id = pi.project_id
            ${whereClause}
            GROUP BY p.id
            ${orderClause}
            LIMIT ? OFFSET ?
        `;

        queryParams.push(limit, offset);
        const projects = await executeQuery(query, queryParams);

        return projects.map(project => ({
            ...project,
            featured: Boolean(project.is_featured),
            long_description: project.content || project.detailed_description,
            skills: project.skills ? project.skills.split(',') : [],
            tags: project.tags ? project.tags.split(',') : [],
            images: project.images ? project.images.split(',') : []
        }));
    },

    /**
     * @description 필터 조건에 맞는 프로젝트 총 개수를 반환한다.
     * @param {Object} filters 필터 옵션
     * @returns {Promise<number>} 프로젝트 총 개수
     */
    async getCountWithFilters(filters = {}) {
        const {
            search = '',
            tags = [],
            skills = [],
            featured = null,
            status = 'published',
            published_only = true
        } = filters;

        let whereConditions = [];
        let queryParams = [];

        if (status === 'published') {
            whereConditions.push('p.is_published = 1');
        } else if (status === 'draft') {
            whereConditions.push('p.is_published = 0');
        } else if (published_only) {
            whereConditions.push('p.is_published = 1');
        }

        if (featured !== null) {
            whereConditions.push('p.is_featured = ?');
            queryParams.push(featured ? 1 : 0);
        }

        if (tags && tags.length > 0) {
            const tagPlaceholders = tags.map(() => '?').join(',');
            whereConditions.push(`
                p.id IN (
                    SELECT tu.content_id 
                    FROM tag_usage tu 
                    INNER JOIN tags t ON tu.tag_id = t.id 
                    WHERE tu.content_type = 'project' 
                    AND t.slug IN (${tagPlaceholders})
                )
            `);
            queryParams.push(...tags);
        }

        if (skills && skills.length > 0) {
            const skillPlaceholders = skills.map(() => '?').join(',');
            whereConditions.push(`
                p.id IN (
                    SELECT ps.project_id 
                    FROM project_skills ps 
                    INNER JOIN skills s ON ps.skill_id = s.id 
                    WHERE s.name IN (${skillPlaceholders})
                )
            `);
            queryParams.push(...skills);
        }

        if (search && search.trim()) {
            const searchTerm = `%${search.trim()}%`;
            whereConditions.push(`(
                p.title LIKE ? OR 
                p.short_description LIKE ? OR 
                p.detailed_description LIKE ? OR
                p.content LIKE ? OR
                p.technologies LIKE ?
            )`);
            queryParams.push(searchTerm, searchTerm, searchTerm, searchTerm, searchTerm);
        }

        const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';

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
     * @description ID 기반으로 프로젝트 상세 정보를 조회한다.
     * @param {number} id 프로젝트 ID
     * @returns {Promise<Object|null>} 프로젝트 정보 또는 null
     */
    async getById(id) {
        const project = await executeQuerySingle(`
            SELECT * FROM projects WHERE id = ?
        `, [id]);
        
        if (!project) return null;

        const skills = await executeQuery(`
            SELECT s.* FROM skills s
            INNER JOIN project_skills ps ON s.id = ps.skill_id
            WHERE ps.project_id = ?
            ORDER BY s.name ASC
        `, [id]);

        const images = await executeQuery(`
            SELECT * FROM project_images 
            WHERE project_id = ?
            ORDER BY display_order ASC
        `, [id]);

        const tags = await executeQuery(`
            SELECT t.* FROM tags t
            INNER JOIN tag_usage tu ON t.id = tu.tag_id
            WHERE tu.content_type = 'project' AND tu.content_id = ?
            ORDER BY t.name ASC
        `, [id]);

        return {
            ...project,
            featured: Boolean(project.is_featured), // is_featured를 boolean으로 변환
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

        const skills = await executeQuery(`
            SELECT s.* FROM skills s
            INNER JOIN project_skills ps ON s.id = ps.skill_id
            WHERE ps.project_id = ?
            ORDER BY s.name ASC
        `, [project.id]);

        const images = await executeQuery(`
            SELECT * FROM project_images 
            WHERE project_id = ?
            ORDER BY display_order ASC
        `, [project.id]);

        const tags = await executeQuery(`
            SELECT t.* FROM tags t
            INNER JOIN tag_usage tu ON t.id = tu.tag_id
            WHERE tu.content_type = 'project' AND tu.content_id = ?
            ORDER BY t.name ASC
        `, [project.id]);

        return {
            ...project,
            featured: Boolean(project.is_featured), // is_featured를 boolean으로 변환
            long_description: project.content || project.detailed_description, // content 우선, 없으면 detailed_description
            skills,
            images,
            tags
        };
    },

    /**
     * @description 추천 프로젝트 목록을 조회한다.
     * @param {number} [limit=5] 최대 조회 개수
     * @param {number} [offset=0] 시작 오프셋
     * @returns {Promise<Array>} 추천 프로젝트 목록
     */
    async getFeatured(limit = 5, offset = 0) {
        return await (async () => {
            let query = `
                SELECT p.*, 
                       GROUP_CONCAT(DISTINCT s.name ORDER BY s.name ASC) as skills,
                       GROUP_CONCAT(DISTINCT t.name ORDER BY t.name ASC) as tags,
                       GROUP_CONCAT(DISTINCT pi.image_url ORDER BY pi.display_order ASC) as images
                FROM projects p
                LEFT JOIN project_skills ps ON p.id = ps.project_id
                LEFT JOIN skills s ON ps.skill_id = s.id
                LEFT JOIN tag_usage tu ON tu.content_type = 'project' AND tu.content_id = p.id
                LEFT JOIN tags t ON t.id = tu.tag_id
                LEFT JOIN project_images pi ON p.id = pi.project_id
                WHERE p.is_featured = 1 AND p.is_published = 1
                GROUP BY p.id
                ORDER BY p.display_order ASC, p.created_at DESC
                LIMIT ? OFFSET ?
            `;
            
            const projects = await executeQuery(query, [limit, offset]);
            
            const mappedProjects = projects.map(project => ({
                ...project,
                featured: Boolean(project.is_featured), // is_featured를 boolean으로 변환
                long_description: project.content || project.detailed_description, // content 우선, 없으면 detailed_description
                skills: project.skills ? project.skills.split(',') : [],
                tags: project.tags ? project.tags.split(',') : [],
                images: project.images ? project.images.split(',') : []
            }));
            
            return mappedProjects;
        })();
    },

    /**
     * @description 새 프로젝트를 생성하고 생성된 ID를 반환한다.
     * @param {Object} data 프로젝트 데이터
     * @returns {Promise<number>} 신규 프로젝트 ID
     */
    async create(data) {
        const { title, description, detailed_description, content, excerpt, meta_description, thumbnail_image, featured_image, demo_url, project_url, github_url, start_date, end_date, is_ongoing, status, is_featured, is_published, display_order, meta_keywords, tags } = data;
        
        const finalDemoUrl = demo_url || project_url;
        
        const slug = this.generateSlug(title);
        
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
        const result = await executeQuery(query, sanitizedData);
        const projectId = result.insertId;
        if (tags && Array.isArray(tags) && tags.length > 0) {
            await this.updateTags(projectId, tags);
        }
        return projectId;
    },

    /**
     * @description 프로젝트 레코드를 업데이트하고 최신 데이터를 반환한다.
     * @param {number} id 수정할 프로젝트 ID
     * @param {Object} data 업데이트할 필드 값
     * @returns {Promise<Object>} 갱신된 프로젝트 정보
     */
    async update(id, data) {
        const { title, description, detailed_description, content, excerpt, meta_description, thumbnail_image, featured_image, demo_url, project_url, github_url, start_date, end_date, is_ongoing, status, is_featured, is_published, display_order, meta_keywords, tags } = data;
        
        const finalDemoUrl = demo_url || project_url;
        
        const slug = title ? this.generateSlug(title) : null;
        
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
            demo_url || null,
            github_url || null,
            start_date || null,
            end_date || null,
            is_ongoing || false,
            status || 'completed',
            is_featured || false,
            is_published || false,
            display_order || 0,
            meta_keywords || null,
            id
        ];
        
        const updateFields = [];
        const updateValues = [];
        
        if (title !== undefined) {
            updateFields.push('title = ?');
            updateValues.push(title);
            if (slug !== undefined) {
                updateFields.push('slug = ?');
                updateValues.push(slug);
            }
        }
        if (description !== undefined) updateFields.push('description = ?'), updateValues.push(description);
        if (detailed_description !== undefined) updateFields.push('detailed_description = ?'), updateValues.push(detailed_description);
        if (content !== undefined) updateFields.push('content = ?'), updateValues.push(content);
        if (excerpt !== undefined) updateFields.push('excerpt = ?'), updateValues.push(excerpt);
        if (meta_description !== undefined) updateFields.push('meta_description = ?'), updateValues.push(meta_description);
        if (thumbnail_image !== undefined) updateFields.push('thumbnail_image = ?'), updateValues.push(thumbnail_image);
        if (featured_image !== undefined) updateFields.push('featured_image = ?'), updateValues.push(featured_image);
        if (finalDemoUrl !== undefined) updateFields.push('demo_url = ?'), updateValues.push(finalDemoUrl);
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
        
        updateFields.push('updated_at = NOW()');
        
        if (updateFields.length === 0) {
            return await this.getById(id);
        }
        
        const query = `UPDATE projects SET ${updateFields.join(', ')} WHERE id = ?`;
        updateValues.push(id);
        
        await executeQuery(query, updateValues);
        if (tags) {
            await this.updateTags(id, tags);
        }
        return await this.getById(id);
    },

    /**
     * @description 프로젝트와 연관된 하위 데이터를 모두 삭제한다.
     * @param {number} id 삭제할 프로젝트 ID
     * @returns {Promise<void>}
     */
    async delete(id) {
        await executeQuery('DELETE FROM project_skills WHERE project_id = ?', [id]);
        await executeQuery('DELETE FROM project_images WHERE project_id = ?', [id]);
        await executeQuery("DELETE FROM tag_usage WHERE content_type = 'project' AND content_id = ?", [id]);
        await executeQuery('DELETE FROM projects WHERE id = ?', [id]);
    },

    /**
     * @description 프로젝트 조회수를 1 증가시킨다.
     * @param {number} id 프로젝트 ID
     * @returns {Promise<void>}
     */
    async incrementView(id) {
        await executeQuery('UPDATE projects SET view_count = view_count + 1 WHERE id = ?', [id]);
    },

    /**
     * @description 프로젝트에 스킬 관계를 추가한다.
     * @param {number} projectId 프로젝트 ID
     * @param {number} skillId 스킬 ID
     * @returns {Promise<void>}
     */
    async addSkill(projectId, skillId) {
        const query = `
            INSERT IGNORE INTO project_skills (project_id, skill_id)
            VALUES (?, ?)
        `;
        await executeQuery(query, [projectId, skillId]);
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
    async addImage(projectId, imageUrl, altText = null, displayOrder = 0) {
        const query = `
            INSERT INTO project_images (project_id, image_url, alt_text, display_order)
            VALUES (?, ?, ?, ?)
        `;
        const result = await executeQuery(query, [projectId, imageUrl, altText, displayOrder]);
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
    async updateTags(projectId, tagNames) {
        await executeQuery("DELETE FROM tag_usage WHERE content_type = 'project' AND content_id = ?", [projectId]);
        
        for (const tagName of tagNames) {
            const trimmed = String(tagName).trim();
            if (!trimmed) continue;
            let tag = await executeQuerySingle('SELECT id FROM tags WHERE name = ?', [trimmed]);
            if (!tag) {
                const tagSlug = trimmed.toLowerCase().replace(/[^a-z0-9]/g, '-').replace(/-+/g, '-').trim('-');
                const result = await executeQuery("INSERT INTO tags (name, slug, type) VALUES (?, ?, 'project')", [trimmed, tagSlug]);
                tag = { id: result.insertId };
            }
            await executeQuery("INSERT IGNORE INTO tag_usage (tag_id, content_type, content_id) VALUES (?, 'project', ?)", [tag.id, projectId]);
        }
        await executeQuery('UPDATE tags t LEFT JOIN (SELECT tag_id, COUNT(*) cnt FROM tag_usage GROUP BY tag_id) u ON t.id = u.tag_id SET t.usage_count = COALESCE(u.cnt, 0)');
    }
};

module.exports = Projects;
