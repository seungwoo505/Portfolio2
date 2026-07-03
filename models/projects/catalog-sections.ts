const {
    createQueryContext,
    executeQuery,
    executeQuerySingle,
    executeTransaction
} = require('./common');

const SECTION_SELECT = `
    SELECT pcs.*,
           COUNT(csi.project_id) AS item_count
    FROM project_catalog_sections pcs
    LEFT JOIN project_catalog_section_items csi ON csi.section_id = pcs.id
`;

const mapSection = (section) => (
    section ? {
        ...section,
        item_count: Number(section.item_count || 0)
    } : null
);

const getExistingProjectIds = async (projectIds) => {
    const uniqueIds = Array.from(new Set(projectIds.map(Number).filter(Number.isFinite)));
    if (uniqueIds.length === 0) {
        return [];
    }

    const placeholders = uniqueIds.map(() => '?').join(',');
    const rows = await executeQuery(`
        SELECT id
        FROM projects
        WHERE id IN (${placeholders})
    `, uniqueIds);

    return rows.map((row) => Number(row.id));
};

module.exports = {
    async getCatalogSectionsForAdmin() {
        const rows = await executeQuery(`
            ${SECTION_SELECT}
            GROUP BY pcs.id
            ORDER BY pcs.display_order ASC, pcs.id ASC
        `);

        return rows.map(mapSection);
    },

    async getCatalogSectionById(id) {
        const section = await executeQuerySingle(`
            ${SECTION_SELECT}
            WHERE pcs.id = ?
            GROUP BY pcs.id
            LIMIT 1
        `, [id]);

        return mapSection(section);
    },

    async getCatalogSectionItems(sectionId) {
        return await executeQuery(`
            SELECT csi.section_id,
                   csi.project_id,
                   csi.display_order,
                   csi.custom_label,
                   csi.custom_summary,
                   p.title,
                   p.slug
            FROM project_catalog_section_items csi
            INNER JOIN projects p ON p.id = csi.project_id
            WHERE csi.section_id = ?
            ORDER BY csi.display_order ASC, p.title ASC
        `, [sectionId]);
    },

    async createCatalogSection(data) {
        const result = await executeQuery(`
            INSERT INTO project_catalog_sections (
                name,
                slug,
                description,
                section_type,
                display_order,
                is_active
            ) VALUES (?, ?, ?, ?, ?, ?)
        `, [
            data.name,
            data.slug,
            data.description ?? null,
            data.section_type || 'custom',
            data.display_order ?? 0,
            data.is_active === false ? 0 : 1
        ]);

        return result.insertId;
    },

    async updateCatalogSection(id, data) {
        const updates = [];
        const params = [];

        [
            'name',
            'slug',
            'description',
            'section_type',
            'display_order',
            'is_active'
        ].forEach((field) => {
            if (Object.prototype.hasOwnProperty.call(data, field)) {
                updates.push(`${field} = ?`);
                params.push(data[field]);
            }
        });

        if (updates.length === 0) {
            return await this.getCatalogSectionById(id);
        }

        params.push(id);
        await executeQuery(`
            UPDATE project_catalog_sections
            SET ${updates.join(', ')}
            WHERE id = ?
        `, params);

        return await this.getCatalogSectionById(id);
    },

    async deleteCatalogSection(id) {
        const result = await executeQuery(`
            DELETE FROM project_catalog_sections
            WHERE id = ?
        `, [id]);

        return result.affectedRows || 0;
    },

    getExistingProjectIds,

    async replaceCatalogSectionItems(sectionId, items) {
        await executeTransaction(async (connection) => {
            const db = createQueryContext(connection);
            await db.query('DELETE FROM project_catalog_section_items WHERE section_id = ?', [sectionId]);

            for (const item of items) {
                await db.query(`
                    INSERT INTO project_catalog_section_items (
                        section_id,
                        project_id,
                        display_order,
                        custom_label,
                        custom_summary
                    ) VALUES (?, ?, ?, ?, ?)
                `, [
                    sectionId,
                    item.project_id,
                    item.display_order ?? 0,
                    item.custom_label ?? null,
                    item.custom_summary ?? null
                ]);
            }
        });
    }
};

export {};
