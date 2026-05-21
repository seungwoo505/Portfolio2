#!/usr/bin/env node

require('dotenv').config();
const mysql = require('mysql2/promise');
const logger = require('../log');

const sourceSchema = process.env.SOURCE_DB_SCHEMA;
const targetSchema = process.env.TARGET_DB_SCHEMA || process.env.DB_SCHEMA;

const createPool = (database) => mysql.createPool({
    host: process.env.DB_HOST || 'localhost',
    port: Number(process.env.DB_PORT || 3306),
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database,
    charset: 'utf8mb4',
    waitForConnections: true,
    connectionLimit: 5,
    timezone: 'Z'
});

const tablePlans = [
    {
        source: 'personal_info',
        target: 'personal_info',
        columns: [
            'id', 'name', 'full_name', 'title', 'bio', 'about', 'email', 'phone', 'location',
            'avatar_url', 'resume_url', 'github_url', 'linkedin_url', 'twitter_url', 'instagram_url',
            'created_at', 'updated_at'
        ]
    },
    {
        source: 'social_links',
        target: 'social_links',
        columns: ['id', 'platform', 'url', 'icon', 'display_order', 'is_active', 'created_at', 'updated_at']
    },
    {
        source: 'skill_categories',
        target: 'skill_categories',
        columns: ['id', 'name', 'description', 'display_order', 'created_at', 'updated_at']
    },
    {
        source: 'skills',
        target: 'skills',
        columns: [
            'id', 'category_id', 'name', 'proficiency_level', 'years_of_experience', 'icon',
            'color', 'display_order', 'is_featured', 'created_at', 'updated_at'
        ]
    },
    {
        source: 'tags',
        target: 'tags',
        columns: ['id', 'name', 'slug', 'description', 'color', 'type', 'usage_count', 'created_at', 'updated_at']
    },
    {
        source: 'projects',
        target: 'projects',
        columns: [
            'id', 'title', 'slug', 'description', 'short_description', 'detailed_description',
            'content', 'excerpt', 'meta_description', 'meta_keywords', 'thumbnail_image',
            'featured_image', 'demo_url', 'github_url', 'technologies', 'start_date', 'end_date',
            'is_ongoing', 'status', 'is_featured', 'is_published', 'display_order',
            'created_at', 'updated_at'
        ],
        defaults: {
            view_count: 0
        }
    },
    {
        source: 'project_images',
        target: 'project_images',
        columns: ['id', 'project_id', 'image_url', 'alt_text', 'display_order', 'created_at']
    },
    {
        source: 'project_skills',
        target: 'project_skills',
        columns: ['project_id', 'skill_id', 'created_at']
    },
    {
        source: 'blog_posts',
        target: 'blog_posts',
        columns: [
            'id', 'uuid', 'title', 'slug', 'excerpt', 'content', 'featured_image',
            'is_published', 'is_featured', 'reading_time', 'meta_title', 'meta_description',
            'meta_keywords', 'published_at', 'created_at', 'updated_at'
        ],
        defaults: {
            view_count: 0
        }
    },
    {
        source: 'tag_usage',
        target: 'tag_usage',
        columns: ['tag_id', 'content_type', 'content_id', 'created_at'],
        where: "content_type IN ('project', 'blog_post')"
    },
    {
        source: 'experiences',
        target: 'experiences',
        columns: [
            'id', 'type', 'title', 'company_or_institution', 'location', 'description',
            'start_date', 'end_date', 'is_current', 'display_order', 'created_at', 'updated_at'
        ]
    },
    {
        source: 'interests',
        target: 'interests',
        columns: ['id', 'title', 'description', 'icon', 'category', 'display_order', 'created_at', 'updated_at']
    },
    {
        source: 'site_settings',
        target: 'site_settings',
        columns: ['setting_key', 'setting_value', 'setting_type', 'is_public', 'description', 'created_at', 'updated_at'],
        where: 'is_public = TRUE'
    }
];

const quote = (identifier) => `\`${identifier}\``;

const getTargetColumns = async (targetPool, table) => {
    const [rows] = await targetPool.execute(`SHOW COLUMNS FROM ${quote(table)}`);
    return new Set(rows.map((row) => row.Field));
};

const getSourceColumns = async (sourcePool, table) => {
    const [rows] = await sourcePool.execute(`SHOW COLUMNS FROM ${quote(table)}`);
    return new Set(rows.map((row) => row.Field));
};

const selectRows = async (sourcePool, plan, sourceColumns) => {
    const selectedColumns = plan.columns.filter((column) => sourceColumns.has(column));
    const sql = [
        `SELECT ${selectedColumns.map(quote).join(', ')}`,
        `FROM ${quote(plan.source)}`,
        plan.where ? `WHERE ${plan.where}` : ''
    ].filter(Boolean).join(' ');

    const [rows] = await sourcePool.execute(sql);
    return rows;
};

const insertRows = async (targetPool, plan, targetColumns, rows) => {
    if (rows.length === 0) {
        return 0;
    }

    const mappedColumns = [
        ...plan.columns.filter((column) => targetColumns.has(column)),
        ...Object.keys(plan.defaults || {}).filter((column) => targetColumns.has(column))
    ];
    const placeholders = mappedColumns.map(() => '?').join(', ');
    const updateClause = mappedColumns
        .filter((column) => !['id', 'setting_key', 'project_id', 'skill_id', 'tag_id', 'content_type', 'content_id'].includes(column))
        .map((column) => `${quote(column)} = VALUES(${quote(column)})`)
        .join(', ');

    const sql = `
        INSERT INTO ${quote(plan.target)} (${mappedColumns.map(quote).join(', ')})
        VALUES (${placeholders})
        ${updateClause ? `ON DUPLICATE KEY UPDATE ${updateClause}` : ''}
    `;

    for (const row of rows) {
        const values = mappedColumns.map((column) => {
            if (Object.prototype.hasOwnProperty.call(row, column)) {
                return row[column];
            }
            return plan.defaults?.[column] ?? null;
        });
        await targetPool.execute(sql, values);
    }

    return rows.length;
};

const migrateTable = async (sourcePool, targetPool, plan) => {
    const [sourceColumns, targetColumns] = await Promise.all([
        getSourceColumns(sourcePool, plan.source),
        getTargetColumns(targetPool, plan.target)
    ]);
    const rows = await selectRows(sourcePool, plan, sourceColumns);
    const migrated = await insertRows(targetPool, plan, targetColumns, rows);

    logger.info('콘텐츠 테이블 이전 완료', {
        source: plan.source,
        target: plan.target,
        migrated
    });
};

const recalculateTagUsage = async (targetPool) => {
    await targetPool.execute(`
        UPDATE tags t
        LEFT JOIN (
            SELECT tag_id, COUNT(*) AS cnt
            FROM tag_usage
            GROUP BY tag_id
        ) u ON t.id = u.tag_id
        SET t.usage_count = COALESCE(u.cnt, 0)
    `);
};

async function run() {
    if (!sourceSchema || !targetSchema) {
        throw new Error('SOURCE_DB_SCHEMA와 TARGET_DB_SCHEMA 또는 DB_SCHEMA 환경 변수가 필요합니다.');
    }

    if (sourceSchema === targetSchema) {
        throw new Error('콘텐츠 이전은 SOURCE_DB_SCHEMA와 TARGET_DB_SCHEMA가 서로 달라야 합니다.');
    }

    const sourcePool = createPool(sourceSchema);
    const targetPool = createPool(targetSchema);

    try {
        await targetPool.execute('SET FOREIGN_KEY_CHECKS = 0');
        for (const plan of tablePlans) {
            await migrateTable(sourcePool, targetPool, plan);
        }
        await recalculateTagUsage(targetPool);
        await targetPool.execute('SET FOREIGN_KEY_CHECKS = 1');
        logger.info('콘텐츠 이전이 완료되었습니다.', { sourceSchema, targetSchema });
    } catch (error) {
        await targetPool.execute('SET FOREIGN_KEY_CHECKS = 1');
        throw error;
    } finally {
        await sourcePool.end();
        await targetPool.end();
    }
}

if (require.main === module) {
    run().catch((error) => {
        logger.error('콘텐츠 이전 실패', { error: error.message, stack: error.stack });
        process.exit(1);
    });
}

module.exports = {
    run
};
