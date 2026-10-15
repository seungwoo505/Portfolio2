const { createModelFixture } = require('./content-model-fixture');

const normalizeSql = query => query.replace(/\s+/g, ' ').trim().toLowerCase();
const byName = (left, right) => left.name < right.name ? -1 : left.name > right.name ? 1 : 0;

// 실제 프로젝트 모델과 SQL 바인딩은 유지하고 외부 MySQL 경계만 상태 저장소로 대체한다.
// 기존 GROUP_CONCAT 경로의 1024바이트 제한도 재현하여 Node 20에서 항상 실행한다.
const createProjectListFixture = ({ count = 4 } = {}) => {
    const rows = Array.from({ length: count }, (_, index) => ({
        id: index + 1, title: `프로젝트 ${index + 1}`, slug: `project-${index + 1}`,
        description: null, short_description: null, detailed_description: null,
        content: '본문', content_json: null, content_html: null, content_text: '본문',
        excerpt: null, meta_description: null, thumbnail_image: null, featured_image: null,
        demo_url: null, github_url: null, start_date: null, end_date: null,
        is_ongoing: 0, status: 'completed', is_featured: 1, is_published: 1,
        display_order: index, meta_keywords: null, view_count: 0,
        created_at: '2026-10-15 00:00:00', updated_at: '2026-10-15 00:00:00'
    }));
    const images = [];
    const skills = [
        { id: 1, name: 'CI, CD', category_id: null, display_order: 0 },
        { id: 2, name: 'React', category_id: null, display_order: 1 },
        { id: 3, name: 'Node.js', category_id: null, display_order: 2 }
    ];
    const skillLinks = [];
    const tags = [{ id: 1, name: '설계, 구현', slug: 'design', description: null, color: null, type: 'project', usage_count: 1 }];
    const tagLinks = [{ project_id: 1, tag_id: 1 }];
    const relatedSkills = id => skillLinks.filter(link => link.project_id === id)
        .map(link => skills.find(skill => skill.id === link.skill_id));
    const relatedTags = id => tagLinks.filter(link => link.project_id === id)
        .map(link => tags.find(tag => tag.id === link.tag_id));
    const orderedImages = values => values.slice().sort((left, right) => left.display_order - right.display_order || left.id - right.id);

    const execute = async (query, params = []) => {
        const sql = normalizeSql(query);
        if (sql.startsWith('insert into project_images ')) {
            const image = { id: images.length + 1, project_id: params[0], image_url: params[1], alt_text: params[2], display_order: params[3] };
            images.push(image);
            return { insertId: image.id };
        }
        if (sql.startsWith('insert ignore into project_skills ')) {
            if (!skillLinks.some(link => link.project_id === params[0] && link.skill_id === params[1])) {
                skillLinks.push({ project_id: params[0], skill_id: params[1] });
            }
            return { affectedRows: 1 };
        }
        if (sql.startsWith('select') && sql.includes('from project_images')) {
            const selected = images.filter(image => params.includes(image.project_id));
            return (sql.includes('order by display_order asc') ? orderedImages(selected) : selected).map(image => ({ ...image }));
        }
        if (sql.startsWith('select s.* from skills s inner join project_skills ')) {
            return relatedSkills(params[0]).map(skill => ({ ...skill })).sort(byName);
        }
        if (sql.startsWith('select distinct ps.project_id, s.name from project_skills ps inner join skills s')) {
            return skillLinks.filter(link => params.includes(link.project_id))
                .map(link => ({ project_id: link.project_id, name: skills.find(skill => skill.id === link.skill_id).name })).sort(byName);
        }
        if (sql.startsWith('select t.* from tags t inner join tag_usage ')) {
            return relatedTags(params[0]).map(tag => ({ ...tag }));
        }
        if (sql.startsWith('select distinct tu.content_id, t.name from tag_usage tu inner join tags t')) {
            if (params[0] !== 'project') throw new Error('프로젝트 태그 종류가 필요합니다.');
            return tagLinks.filter(link => params.slice(1).includes(link.project_id))
                .map(link => ({ content_id: link.project_id, name: tags.find(tag => tag.id === link.tag_id).name })).sort(byName);
        }
        if (sql.startsWith('select * from projects where ')) {
            const field = sql.includes('where slug =') ? 'slug' : 'id';
            return rows.filter(row => row[field] === params[0]).map(row => ({ ...row }));
        }
        if (sql.startsWith('select') && sql.includes('from projects p')) {
            let selected = rows.slice();
            if (sql.includes('p.is_published = 1')) selected = selected.filter(row => row.is_published === 1);
            if (sql.includes('p.is_featured = 1')) selected = selected.filter(row => row.is_featured === 1);
            if (sql.includes('p.is_featured = ?')) selected = selected.filter(row => row.is_featured === params[0]);
            const skillFilter = /s\.name in \(([^)]+)\)/.exec(sql);
            if (skillFilter) {
                const start = (sql.slice(0, skillFilter.index).match(/\?/g) || []).length;
                const names = params.slice(start, start + skillFilter[1].split(',').length);
                selected = selected.filter(row => relatedSkills(row.id).some(skill => names.includes(skill.name)));
            }
            if (sql.includes('count(distinct p.id)')) return [{ total: selected.length }];
            selected.sort((left, right) => right.is_featured - left.is_featured || left.display_order - right.display_order);
            if (sql.includes('limit ? offset ?')) selected = selected.slice(params.at(-1), params.at(-1) + params.at(-2));
            return selected.map(row => {
                const result = { ...row };
                if (sql.includes('group_concat(distinct pi.image_url')) {
                    const urls = [...new Set(orderedImages(images.filter(image => image.project_id === row.id)).map(image => image.image_url))];
                    result.images = urls.length ? Buffer.from(urls.join(',')).subarray(0, 1024).toString() : null;
                }
                return result;
            });
        }
        throw new Error(`지원하지 않는 테스트 DB 쿼리: ${sql}`);
    };

    return { ...createModelFixture(['models', 'projects.ts'], { execute }), rows, images, skills, skillLinks };
};

module.exports = { createProjectListFixture };
