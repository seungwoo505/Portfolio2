const { createModelFixture } = require('./content-model-fixture');

// DB 경계만 대체한다. 저장된 태그/관계로 목록과 상세 응답을 만들고
// 기존 MySQL GROUP_CONCAT 경로에는 기본 1024자 제한을 적용한다.
const createContentTagFixture = (family, { skills = new Map(), skillLinks = [] } = {}) => {
    const table = family === 'projects' ? 'projects' : 'blog_posts';
    const contentType = family === 'projects' ? 'project' : 'blog_post';
    const rows = [];
    const tags = [];
    const links = [];
    const relatedTags = id => links
        .filter(link => link.content_type === contentType && link.content_id === id)
        .map(link => tags.find(tag => tag.id === link.tag_id));
    const relatedSkills = id => skillLinks.filter(link => link.project_id === id)
        .map(link => skills.get(link.skill_id)).filter(Boolean);
    const ordered = values => values.sort((a, b) => a.name < b.name ? -1 : a.name > b.name ? 1 : 0);

    const execute = async (query, params = []) => {
        const sql = query.replace(/\s+/g, ' ').trim().toLowerCase();
        if (sql.startsWith(`insert into ${table} `)) {
            const columns = sql.match(/\(([^)]+)\)/)[1].split(',').map(column => column.trim());
            const row = { id: rows.length + 1, created_at: '2026-10-15', view_count: 0 };
            columns.forEach((column, index) => { row[column] = params[index]; });
            rows.push(row);
            return { insertId: row.id };
        }
        if (sql.startsWith(`update ${table} set `)) {
            const row = rows.find(item => item.id === params.at(-1));
            let offset = 0;
            for (const assignment of sql.split(' set ')[1].split(' where ')[0].split(',')) {
                const field = assignment.trim().match(/^(\w+) = \?$/);
                if (field) row[field[1]] = params[offset++];
            }
            return { affectedRows: 1 };
        }
        if (sql.startsWith('select id from tags where ')) {
            const field = sql.includes('where name =') ? 'name' : 'slug';
            return tags.filter(tag => tag[field] === params[0]).map(tag => ({ id: tag.id }));
        }
        if (sql.startsWith('insert into tags ')) {
            const tag = { id: tags.length + 1, name: params[0], slug: params[1], usage_count: 0 };
            tags.push(tag);
            return { insertId: tag.id };
        }
        if (sql.startsWith('delete from tag_usage ')) {
            for (let index = links.length - 1; index >= 0; index -= 1) {
                if (links[index].content_type === contentType && links[index].content_id === params[0]) links.splice(index, 1);
            }
            return { affectedRows: 1 };
        }
        if (sql.startsWith('insert ignore into tag_usage ')) {
            if (!links.some(link => link.tag_id === params[0] && link.content_type === contentType && link.content_id === params[1])) {
                links.push({ tag_id: params[0], content_type: contentType, content_id: params[1] });
            }
            return { affectedRows: 1 };
        }
        if (sql.startsWith('update tags t left join ')) {
            tags.forEach(tag => { tag.usage_count = links.filter(link => link.tag_id === tag.id).length; });
            return { affectedRows: 1 };
        }
        if (sql.startsWith(`select id from ${table} where slug =`)) return [];
        if (sql.startsWith(`select * from ${table} where `)) {
            const field = sql.includes('where slug =') ? 'slug' : 'id';
            return rows.filter(row => row[field] === params[0]).map(row => ({ ...row }));
        }
        if (sql.startsWith('select t.* from tags t ')) {
            return ordered(relatedTags(params[0]).map(tag => ({ ...tag })));
        }
        if (sql.startsWith('insert ignore into project_skills ')) {
            if (!skillLinks.some(link => link.project_id === params[0] && link.skill_id === params[1])) {
                skillLinks.push({ project_id: params[0], skill_id: params[1] });
            }
            return { affectedRows: 1 };
        }
        if (sql.includes('from project_images')) return [];
        if (sql.includes('from skills s inner join project_skills')) {
            return ordered(relatedSkills(params[0]).map(skill => ({ ...skill })));
        }
        if (sql.startsWith('select') && sql.includes('from project_skills ps inner join skills s')) {
            const selected = skillLinks.filter(link => params.includes(link.project_id))
                .map(link => ({ project_id: link.project_id, name: skills.get(link.skill_id)?.name }))
                .filter(row => row.name !== undefined);
            return sql.includes('order by s.name asc') ? ordered(selected) : selected;
        }
        if (sql.startsWith('select') && sql.includes('from tag_usage tu inner join tags t')) {
            const [type, ...ids] = params;
            return ordered(links.filter(link => link.content_type === type && ids.includes(link.content_id))
                .map(link => ({ content_id: link.content_id, name: tags.find(tag => tag.id === link.tag_id).name })));
        }
        if (sql.startsWith('select') && sql.includes(`from ${table} `)) {
            let selected = rows;
            if (sql.includes('where t.slug = ?')) {
                selected = selected.filter(row => relatedTags(row.id).some(tag => tag.slug === params[0]));
            }
            if (sql.includes('is_published = true') || sql.includes('is_published = 1')) selected = selected.filter(row => row.is_published);
            if (sql.includes('is_featured = true') || sql.includes('is_featured = 1')) selected = selected.filter(row => row.is_featured);
            const searchFields = [...sql.matchAll(/p\.(\w+) like \?/g)].map(match => match[1]);
            if (searchFields.length > 0) {
                const searchEnd = params.length - (sql.includes('limit ? offset ?') ? 2 : 0);
                const searchParams = params.slice(searchEnd - searchFields.length, searchEnd);
                selected = selected.filter(row => searchFields.some((field, index) =>
                    String(row[field] || '').includes(String(searchParams[index]).slice(1, -1))));
            }
            if (sql.includes('count(distinct p.id)')) return [{ total: selected.length }];
            if (sql.includes('limit ? offset ?')) selected = selected.slice(params.at(-1), params.at(-1) + params.at(-2));
            return selected.map(row => ({
                ...row,
                ...(sql.includes('as tags') ? { tags: ordered(relatedTags(row.id)).map(tag => tag.name).join(',').slice(0, 1024) } : {}),
                ...(table === 'projects' ? {
                    ...(sql.includes('as skills') ? { skills: ordered(relatedSkills(row.id)).map(skill => skill.name).join(',').slice(0, 1024) || null } : {}),
                    images: null
                } : {})
            }));
        }
        throw new Error(`지원하지 않는 테스트 DB 쿼리: ${sql}`);
    };

    return { ...createModelFixture(['models', family + '.ts'], { execute }), rows, tags, links, skills, skillLinks };
};

module.exports = { createContentTagFixture };
