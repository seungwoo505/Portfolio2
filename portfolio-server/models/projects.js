const { executeQuery, executeQuerySingle } = require('./db-utils');
const CacheUtils = require('../utils/cache');

const Projects = {
    // 슬러그 생성 함수
    generateSlug(title) {
        return title
            .toLowerCase()
            .replace(/[^a-z0-9가-힣\s-]/g, '') // 한글, 영문, 숫자, 공백, 하이픈만 허용
            .replace(/\s+/g, '-') // 공백을 하이픈으로 변환
            .replace(/-+/g, '-') // 연속된 하이픈을 하나로
            .trim('-'); // 앞뒤 하이픈 제거
    },
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

    // 🔍 고급 검색, 정렬, 필터링을 지원하는 프로젝트 조회
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

        // WHERE 조건 구성
        let whereConditions = [];
        let queryParams = [];

        // 상태 필터
        if (status === 'published') {
            whereConditions.push('p.is_published = 1');
        } else if (status === 'draft') {
            whereConditions.push('p.is_published = 0');
        } else if (published_only) {
            whereConditions.push('p.is_published = 1');
        }

        // featured 필터
        if (featured !== null) {
            whereConditions.push('p.is_featured = ?');
            queryParams.push(featured ? 1 : 0);
        }

        // 태그 필터
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

        // 스킬 필터
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

        // 검색 조건
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

        // 정렬 조건
        let orderClause = '';
        const validSortFields = ['created_at', 'title', 'view_count', 'display_order'];
        const validOrders = ['asc', 'desc'];
        
        const sortField = validSortFields.includes(sort) ? sort : 'created_at';
        const sortOrder = validOrders.includes(order.toLowerCase()) ? order.toUpperCase() : 'DESC';
        
        // 기본 정렬: featured 우선, 그 다음 지정된 정렬
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

    // 🔍 필터 조건에 따른 총 개수 조회
    async getCountWithFilters(filters = {}) {
        const {
            search = '',
            tags = [],
            skills = [],
            featured = null,
            status = 'published',
            published_only = true
        } = filters;

        // WHERE 조건 구성
        let whereConditions = [];
        let queryParams = [];

        // 상태 필터
        if (status === 'published') {
            whereConditions.push('p.is_published = 1');
        } else if (status === 'draft') {
            whereConditions.push('p.is_published = 0');
        } else if (published_only) {
            whereConditions.push('p.is_published = 1');
        }

        // featured 필터
        if (featured !== null) {
            whereConditions.push('p.is_featured = ?');
            queryParams.push(featured ? 1 : 0);
        }

        // 태그 필터
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

        // 스킬 필터
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

        // 검색 조건
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

    async getById(id) {
        const project = await executeQuerySingle(`
            SELECT * FROM projects WHERE id = ?
        `, [id]);
        
        if (!project) return null;

        // 프로젝트 스킬들 조회
        const skills = await executeQuery(`
            SELECT s.* FROM skills s
            INNER JOIN project_skills ps ON s.id = ps.skill_id
            WHERE ps.project_id = ?
            ORDER BY s.name ASC
        `, [id]);

        // 프로젝트 이미지들 조회
        const images = await executeQuery(`
            SELECT * FROM project_images 
            WHERE project_id = ?
            ORDER BY display_order ASC
        `, [id]);

        // 프로젝트 태그 조회
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

    async getBySlug(slug) {
        const project = await executeQuerySingle(`
            SELECT * FROM projects WHERE slug = ?
        `, [slug]);
        
        if (!project) return null;

        // 프로젝트 스킬들 조회
        const skills = await executeQuery(`
            SELECT s.* FROM skills s
            INNER JOIN project_skills ps ON s.id = ps.skill_id
            WHERE ps.project_id = ?
            ORDER BY s.name ASC
        `, [project.id]);

        // 프로젝트 이미지들 조회
        const images = await executeQuery(`
            SELECT * FROM project_images 
            WHERE project_id = ?
            ORDER BY display_order ASC
        `, [project.id]);

        // 프로젝트 태그 조회
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

    async create(data) {
        const { title, description, detailed_description, content, excerpt, meta_description, thumbnail_image, featured_image, demo_url, github_url, start_date, end_date, is_ongoing, status, is_featured, is_published, display_order, meta_keywords, tags } = data;
        
        // 슬러그 생성 (제목 기반)
        const slug = this.generateSlug(title);
        
        // undefined 값을 null로 변환
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

    async update(id, data) {
        const { title, description, detailed_description, content, excerpt, meta_description, thumbnail_image, featured_image, demo_url, github_url, start_date, end_date, is_ongoing, status, is_featured, is_published, display_order, meta_keywords, tags } = data;
        
        // 슬러그 생성 (제목이 있을 때만)
        const slug = title ? this.generateSlug(title) : null;
        
        // undefined 값을 null로 변환
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
        
        // 부분 업데이트를 위한 동적 쿼리 생성
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
        if (demo_url !== undefined) updateFields.push('demo_url = ?'), updateValues.push(demo_url);
        if (github_url !== undefined) updateFields.push('github_url = ?'), updateValues.push(github_url);
        if (start_date !== undefined) updateFields.push('start_date = ?'), updateValues.push(start_date);
        if (end_date !== undefined) updateFields.push('end_date = ?'), updateValues.push(end_date);
        if (is_ongoing !== undefined) updateFields.push('is_ongoing = ?'), updateValues.push(is_ongoing);
        if (status !== undefined) updateFields.push('status = ?'), updateValues.push(status);
        if (is_featured !== undefined) {
            // is_featured 업데이트 로그 제거됨 (성능 최적화)
            updateFields.push('is_featured = ?'), updateValues.push(is_featured);
        }
        if (is_published !== undefined) updateFields.push('is_published = ?'), updateValues.push(is_published);
        if (display_order !== undefined) updateFields.push('display_order = ?'), updateValues.push(display_order);
        if (meta_keywords !== undefined) updateFields.push('meta_keywords = ?'), updateValues.push(meta_keywords);
        
        // updated_at은 항상 업데이트
        updateFields.push('updated_at = NOW()');
        
        if (updateFields.length === 0) {
            // 업데이트할 필드가 없으면 그냥 반환
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

    async delete(id) {
        // 연관된 데이터들도 함께 삭제 (CASCADE)
        await executeQuery('DELETE FROM project_skills WHERE project_id = ?', [id]);
        await executeQuery('DELETE FROM project_images WHERE project_id = ?', [id]);
        await executeQuery("DELETE FROM tag_usage WHERE content_type = 'project' AND content_id = ?", [id]);
        await executeQuery('DELETE FROM projects WHERE id = ?', [id]);
    },

    async incrementView(id) {
        await executeQuery('UPDATE projects SET view_count = view_count + 1 WHERE id = ?', [id]);
    },

    async addSkill(projectId, skillId) {
        const query = `
            INSERT IGNORE INTO project_skills (project_id, skill_id)
            VALUES (?, ?)
        `;
        await executeQuery(query, [projectId, skillId]);
    },

    async removeSkill(projectId, skillId) {
        await executeQuery('DELETE FROM project_skills WHERE project_id = ? AND skill_id = ?', [projectId, skillId]);
    },

    async addImage(projectId, imageUrl, altText = null, displayOrder = 0) {
        const query = `
            INSERT INTO project_images (project_id, image_url, alt_text, display_order)
            VALUES (?, ?, ?, ?)
        `;
        const result = await executeQuery(query, [projectId, imageUrl, altText, displayOrder]);
        return result.insertId;
    },

    async removeImage(imageId) {
        await executeQuery('DELETE FROM project_images WHERE id = ?', [imageId]);
    },

    async updateImageOrder(imageId, displayOrder) {
        await executeQuery('UPDATE project_images SET display_order = ? WHERE id = ?', [displayOrder, imageId]);
    },

    async updateTags(projectId, tagNames) {
        // 기존 연결 제거
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
        // 사용량 업데이트
        await executeQuery('UPDATE tags t LEFT JOIN (SELECT tag_id, COUNT(*) cnt FROM tag_usage GROUP BY tag_id) u ON t.id = u.tag_id SET t.usage_count = COALESCE(u.cnt, 0)');
    }
};

module.exports = Projects;
