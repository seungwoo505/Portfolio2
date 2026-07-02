const {
    createQueryContext,
    createUniqueSlug,
    executeTransaction,
    hasOwn,
    normalizeOptionalUrl,
    pickFirstString,
    toCsvStringArray
} = require('./common');

const serializeContentJson = (value) => {
    if (value === undefined || value === null || value === '') {
        return null;
    }

    if (typeof value === 'string') {
        return value;
    }

    return JSON.stringify(value);
};

const toInteger = (value, fallback = 0) => {
    const parsed = Number(value);
    return Number.isSafeInteger(parsed) ? parsed : fallback;
};

const toBooleanValue = (value, fallback = false) => {
    if (value === true || value === false) {
        return value;
    }

    if (value === 1 || value === '1' || value === 'true' || value === 'on') {
        return true;
    }

    if (value === 0 || value === '0' || value === 'false' || value === 'off') {
        return false;
    }

    return fallback;
};

const asObject = (value) => (
    value && typeof value === 'object' && !Array.isArray(value) ? value : {}
);

const asArray = (value) => {
    if (Array.isArray(value)) {
        return value;
    }

    if (value === undefined || value === null || value === '') {
        return [];
    }

    return toCsvStringArray(value);
};

const normalizeProjectBaseData = (data) => {
    const catalog = asObject(data.catalog);
    const title = pickFirstString(data.title, data.catalog_title, catalog.title, catalog.catalog_title);
    const summary = pickFirstString(data.summary, data.catalog_summary, catalog.summary, catalog.catalog_summary);

    return {
        title,
        slug: data.slug,
        summary,
        description: pickFirstString(data.description, data.content_text, summary),
        content_html: data.content_html ?? null,
        content_json: serializeContentJson(data.content_json),
        content_text: data.content_text ?? null,
        status: data.status || data.project_status || 'completed',
        project_type: data.project_type || data.type || 'web_app',
        role_summary: data.role_summary || null,
        start_date: data.start_date || null,
        end_date: data.end_date || null,
        is_ongoing: toBooleanValue(data.is_ongoing, false),
        is_published: toBooleanValue(data.is_published, false),
        is_featured: toBooleanValue(data.is_featured ?? data.featured, false),
        display_order: toInteger(data.display_order, 0),
        meta_title: data.meta_title || title || null,
        meta_description: data.meta_description || summary || null,
        meta_keywords: data.meta_keywords || null,
        published_at: data.published_at || null
    };
};

const normalizeCatalogData = (data) => {
    const catalog = asObject(data.catalog);
    const primaryMetric = asObject(catalog.primary_metric || data.primary_metric);
    const title = pickFirstString(data.catalog_title, catalog.title, catalog.catalog_title, data.title);
    const summary = pickFirstString(data.catalog_summary, catalog.summary, catalog.catalog_summary, data.summary, data.description);

    return {
        catalog_title: title,
        catalog_summary: summary,
        catalog_label: pickFirstString(data.catalog_label, catalog.label, catalog.catalog_label),
        catalog_status: pickFirstString(data.catalog_status, catalog.status, catalog.catalog_status),
        catalog_badge: pickFirstString(data.catalog_badge, catalog.badge, catalog.catalog_badge),
        catalog_image_url: normalizeOptionalUrl(pickFirstString(data.catalog_image_url, catalog.image_url, catalog.catalog_image_url)),
        catalog_accent_color: pickFirstString(data.catalog_accent_color, catalog.accent_color, catalog.catalog_accent_color),
        catalog_cta_label: pickFirstString(data.catalog_cta_label, catalog.cta_label, catalog.catalog_cta_label) || '상세 보기',
        catalog_priority: toInteger(data.catalog_priority ?? catalog.priority ?? catalog.catalog_priority, 0),
        price_label: pickFirstString(data.price_label, catalog.price_label) || 'Portfolio',
        difficulty_label: pickFirstString(data.difficulty_label, catalog.difficulty_label),
        impact_summary: pickFirstString(data.impact_summary, catalog.impact_summary),
        primary_metric_label: pickFirstString(data.primary_metric_label, catalog.primary_metric_label, primaryMetric.label),
        primary_metric_value: pickFirstString(data.primary_metric_value, catalog.primary_metric_value, primaryMetric.value)
    };
};

const upsertCatalogProfile = async (projectId, data, db) => {
    const catalog = normalizeCatalogData(data);
    await db.query(`
        INSERT INTO project_catalog_profiles (
            project_id,
            catalog_title,
            catalog_summary,
            catalog_label,
            catalog_status,
            catalog_badge,
            catalog_image_url,
            catalog_accent_color,
            catalog_cta_label,
            catalog_priority,
            price_label,
            difficulty_label,
            impact_summary,
            primary_metric_label,
            primary_metric_value
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON DUPLICATE KEY UPDATE
            catalog_title = VALUES(catalog_title),
            catalog_summary = VALUES(catalog_summary),
            catalog_label = VALUES(catalog_label),
            catalog_status = VALUES(catalog_status),
            catalog_badge = VALUES(catalog_badge),
            catalog_image_url = VALUES(catalog_image_url),
            catalog_accent_color = VALUES(catalog_accent_color),
            catalog_cta_label = VALUES(catalog_cta_label),
            catalog_priority = VALUES(catalog_priority),
            price_label = VALUES(price_label),
            difficulty_label = VALUES(difficulty_label),
            impact_summary = VALUES(impact_summary),
            primary_metric_label = VALUES(primary_metric_label),
            primary_metric_value = VALUES(primary_metric_value),
            updated_at = NOW()
    `, [
        projectId,
        catalog.catalog_title,
        catalog.catalog_summary,
        catalog.catalog_label,
        catalog.catalog_status,
        catalog.catalog_badge,
        catalog.catalog_image_url,
        catalog.catalog_accent_color,
        catalog.catalog_cta_label,
        catalog.catalog_priority,
        catalog.price_label,
        catalog.difficulty_label,
        catalog.impact_summary,
        catalog.primary_metric_label,
        catalog.primary_metric_value
    ]);
};

const normalizeImages = (data) => {
    const images = asArray(data.images || data.media);
    const catalogImageUrl = pickFirstString(data.catalog_image_url, asObject(data.catalog).image_url);

    if (catalogImageUrl && !images.some(image => typeof image === 'object' && (image.image_url || image.url) === catalogImageUrl)) {
        images.unshift({
            image_type: 'catalog',
            image_url: catalogImageUrl,
            alt_text: data.title || data.catalog_title || null,
            is_primary: true,
            display_order: 0
        });
    }

    return images;
};

const replaceImages = async (projectId, data, db) => {
    await db.query('DELETE FROM project_images WHERE project_id = ?', [projectId]);

    for (const [index, image] of normalizeImages(data).entries()) {
        const imageUrl = typeof image === 'string' ? image : image.image_url || image.url;
        if (!imageUrl) continue;
        const imageData = typeof image === 'object' ? image : {};
        await db.query(`
            INSERT INTO project_images (
                project_id,
                image_type,
                image_url,
                alt_text,
                caption,
                width,
                height,
                display_order,
                is_primary
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [
            projectId,
            imageData.image_type || imageData.type || 'gallery',
            imageUrl,
            imageData.alt_text || imageData.alt || null,
            imageData.caption || null,
            imageData.width || null,
            imageData.height || null,
            toInteger(imageData.display_order, index),
            toBooleanValue(imageData.is_primary, index === 0)
        ]);
    }
};

const normalizeLinks = (data) => {
    const links = [...asArray(data.links)];

    if (data.demo_url || data.project_url) {
        links.push({
            link_type: 'demo',
            label: 'Demo',
            url: data.demo_url || data.project_url,
            is_primary: true,
            display_order: 0
        });
    }

    if (data.github_url) {
        links.push({
            link_type: 'github',
            label: 'GitHub',
            url: data.github_url,
            is_primary: false,
            display_order: 10
        });
    }

    return links;
};

const replaceLinks = async (projectId, data, db) => {
    await db.query('DELETE FROM project_links WHERE project_id = ?', [projectId]);

    for (const [index, link] of normalizeLinks(data).entries()) {
        const url = typeof link === 'string' ? link : link.url;
        if (!url) continue;
        const linkData = typeof link === 'object' ? link : {};
        await db.query(`
            INSERT INTO project_links (
                project_id,
                link_type,
                label,
                url,
                display_order,
                is_primary
            )
            VALUES (?, ?, ?, ?, ?, ?)
        `, [
            projectId,
            linkData.link_type || linkData.type || 'other',
            linkData.label || linkData.link_type || linkData.type || 'Link',
            url,
            toInteger(linkData.display_order, index),
            toBooleanValue(linkData.is_primary, index === 0)
        ]);
    }
};

const replaceMetrics = async (projectId, data, db) => {
    await db.query('DELETE FROM project_metrics WHERE project_id = ?', [projectId]);

    for (const [index, metric] of asArray(data.metrics).entries()) {
        if (!metric || typeof metric !== 'object') continue;
        if (!metric.label || !metric.value) continue;

        await db.query(`
            INSERT INTO project_metrics (
                project_id,
                metric_group,
                label,
                value,
                unit,
                description,
                display_order,
                is_highlighted
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `, [
            projectId,
            metric.metric_group || metric.group || 'spec',
            metric.label,
            metric.value,
            metric.unit || null,
            metric.description || null,
            toInteger(metric.display_order, index),
            toBooleanValue(metric.is_highlighted, false)
        ]);
    }
};

const replaceSections = async (projectId, sections, db) => {
    await db.query('DELETE FROM project_catalog_section_items WHERE project_id = ?', [projectId]);

    for (const [index, section] of asArray(sections).entries()) {
        const sectionData = typeof section === 'object' ? section : {};
        const sectionId = sectionData.id || null;
        const sectionSlug = typeof section === 'string' ? section : sectionData.slug;
        const foundSection = sectionId
            ? { id: sectionId }
            : await db.querySingle('SELECT id FROM project_catalog_sections WHERE slug = ? LIMIT 1', [sectionSlug]);

        if (!foundSection?.id) continue;

        await db.query(`
            INSERT INTO project_catalog_section_items (
                section_id,
                project_id,
                display_order,
                custom_label,
                custom_summary
            )
            VALUES (?, ?, ?, ?, ?)
            ON DUPLICATE KEY UPDATE
                display_order = VALUES(display_order),
                custom_label = VALUES(custom_label),
                custom_summary = VALUES(custom_summary)
        `, [
            foundSection.id,
            projectId,
            toInteger(sectionData.display_order, index),
            sectionData.custom_label || null,
            sectionData.custom_summary || null
        ]);
    }
};

const relationFieldProvided = (data, field) => hasOwn(data, field) && data[field] !== undefined;

module.exports = {
    /**
     * @description 쇼핑몰형 프로젝트와 카탈로그 관계 데이터를 한 트랜잭션에서 생성한다.
     * @param {Object} data 프로젝트 데이터
     * @returns {Promise<number>} 신규 프로젝트 ID
     */
    async create(data) {
        const baseData = normalizeProjectBaseData(data);

        return await executeTransaction(async (connection) => {
            const db = createQueryContext(connection);
            const slug = await createUniqueSlug({
                value: baseData.title,
                providedSlug: data.slug,
                fallback: 'project',
                maxLength: 255,
                exists: async candidate => !!(await db.querySingle(
                    'SELECT id FROM projects WHERE slug = ? LIMIT 1',
                    [candidate]
                ))
            });

            const result = await db.query(`
                INSERT INTO projects (
                    title,
                    slug,
                    summary,
                    description,
                    content_html,
                    content_json,
                    content_text,
                    status,
                    project_type,
                    role_summary,
                    start_date,
                    end_date,
                    is_ongoing,
                    is_published,
                    is_featured,
                    display_order,
                    meta_title,
                    meta_description,
                    meta_keywords,
                    published_at
                )
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `, [
                baseData.title,
                slug,
                baseData.summary,
                baseData.description,
                baseData.content_html,
                baseData.content_json,
                baseData.content_text,
                baseData.status,
                baseData.project_type,
                baseData.role_summary,
                baseData.start_date,
                baseData.end_date,
                baseData.is_ongoing,
                baseData.is_published,
                baseData.is_featured,
                baseData.display_order,
                baseData.meta_title,
                baseData.meta_description,
                baseData.meta_keywords,
                baseData.published_at
            ]);
            const projectId = result.insertId;

            await upsertCatalogProfile(projectId, data, db);
            await replaceImages(projectId, data, db);
            await replaceLinks(projectId, data, db);
            await replaceMetrics(projectId, data, db);
            await this.updateTags(projectId, data.tags, db);
            await this.updateSkills(projectId, data.skills, db);
            await replaceSections(projectId, data.sections, db);

            return projectId;
        });
    },

    /**
     * @description 쇼핑몰형 프로젝트와 제공된 관계 데이터를 한 트랜잭션에서 갱신한다.
     * @param {number} id 수정할 프로젝트 ID
     * @param {Object} data 업데이트할 필드 값
     * @returns {Promise<Object>} 갱신된 프로젝트 정보
     */
    async update(id, data) {
        await executeTransaction(async (connection) => {
            const db = createQueryContext(connection);
            const baseData = normalizeProjectBaseData(data);
            let slug = null;

            if (hasOwn(data, 'slug') || hasOwn(data, 'title') || hasOwn(data, 'catalog_title')) {
                slug = await createUniqueSlug({
                    value: baseData.title,
                    providedSlug: data.slug,
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
            const pushField = (field, value) => {
                if (value !== undefined) {
                    updateFields.push(`${field} = ?`);
                    updateValues.push(value);
                }
            };

            pushField('title', hasOwn(data, 'title') || hasOwn(data, 'catalog_title') ? baseData.title : undefined);
            pushField('slug', slug || undefined);
            pushField('summary', hasOwn(data, 'summary') || hasOwn(data, 'catalog_summary') ? baseData.summary : undefined);
            pushField('description', hasOwn(data, 'description') ? baseData.description : undefined);
            pushField('content_html', hasOwn(data, 'content_html') ? baseData.content_html : undefined);
            pushField('content_json', hasOwn(data, 'content_json') ? baseData.content_json : undefined);
            pushField('content_text', hasOwn(data, 'content_text') ? baseData.content_text : undefined);
            pushField('status', hasOwn(data, 'status') || hasOwn(data, 'project_status') ? baseData.status : undefined);
            pushField('project_type', hasOwn(data, 'project_type') || hasOwn(data, 'type') ? baseData.project_type : undefined);
            pushField('role_summary', hasOwn(data, 'role_summary') ? baseData.role_summary : undefined);
            pushField('start_date', hasOwn(data, 'start_date') ? baseData.start_date : undefined);
            pushField('end_date', hasOwn(data, 'end_date') ? baseData.end_date : undefined);
            pushField('is_ongoing', hasOwn(data, 'is_ongoing') ? baseData.is_ongoing : undefined);
            pushField('is_published', hasOwn(data, 'is_published') ? baseData.is_published : undefined);
            pushField('is_featured', hasOwn(data, 'is_featured') || hasOwn(data, 'featured') ? baseData.is_featured : undefined);
            pushField('display_order', hasOwn(data, 'display_order') ? baseData.display_order : undefined);
            pushField('meta_title', hasOwn(data, 'meta_title') ? baseData.meta_title : undefined);
            pushField('meta_description', hasOwn(data, 'meta_description') ? baseData.meta_description : undefined);
            pushField('meta_keywords', hasOwn(data, 'meta_keywords') ? baseData.meta_keywords : undefined);
            pushField('published_at', hasOwn(data, 'published_at') ? baseData.published_at : undefined);

            if (updateFields.length > 0) {
                updateFields.push('updated_at = NOW()');
                updateValues.push(id);
                await db.query(`UPDATE projects SET ${updateFields.join(', ')} WHERE id = ?`, updateValues);
            }

            if (hasOwn(data, 'catalog') || Object.keys(data).some(key => key.startsWith('catalog_')) || hasOwn(data, 'price_label')) {
                await upsertCatalogProfile(id, data, db);
            }

            if (relationFieldProvided(data, 'images') || relationFieldProvided(data, 'media') || relationFieldProvided(data, 'catalog_image_url')) {
                await replaceImages(id, data, db);
            }
            if (relationFieldProvided(data, 'links') || relationFieldProvided(data, 'demo_url') || relationFieldProvided(data, 'project_url') || relationFieldProvided(data, 'github_url')) {
                await replaceLinks(id, data, db);
            }
            if (relationFieldProvided(data, 'metrics')) {
                await replaceMetrics(id, data, db);
            }
            if (relationFieldProvided(data, 'tags')) {
                await this.updateTags(id, data.tags, db);
            }
            if (relationFieldProvided(data, 'skills')) {
                await this.updateSkills(id, data.skills, db);
            }
            if (relationFieldProvided(data, 'sections')) {
                await replaceSections(id, data.sections, db);
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

            await db.query('DELETE FROM project_catalog_section_items WHERE project_id = ?', [id]);
            await db.query('DELETE FROM project_metrics WHERE project_id = ?', [id]);
            await db.query('DELETE FROM project_links WHERE project_id = ?', [id]);
            await db.query('DELETE FROM project_images WHERE project_id = ?', [id]);
            await db.query('DELETE FROM project_skills WHERE project_id = ?', [id]);
            await db.query('DELETE FROM project_tags WHERE project_id = ?', [id]);
            await db.query('DELETE FROM project_catalog_profiles WHERE project_id = ?', [id]);
            await db.query('DELETE FROM projects WHERE id = ?', [id]);
            await db.query('UPDATE tags t LEFT JOIN (SELECT tag_id, COUNT(*) cnt FROM project_tags GROUP BY tag_id) u ON t.id = u.tag_id SET t.usage_count = COALESCE(u.cnt, 0)');
        });
    }
};
export {};
