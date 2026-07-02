const { executeQuery, executeQuerySingle } = require('./common');
const { createUniqueSlug } = require('../../utils/slug');

const createSkillSlug = async ({ name, slug, id = null }) => (
    await createUniqueSlug({
        value: name,
        providedSlug: slug,
        fallback: 'skill',
        maxLength: 120,
        exists: async candidate => {
            const query = id
                ? 'SELECT id FROM skills WHERE slug = ? AND id != ? LIMIT 1'
                : 'SELECT id FROM skills WHERE slug = ? LIMIT 1';
            const params = id ? [candidate, id] : [candidate];
            return !!(await executeQuerySingle(query, params));
        }
    })
);

module.exports = {
    /**
     * @description 스킬 모델에 기술을 생성한다.
     * @param {*} data 입력값
     * @returns {Promise<any>} 처리 결과
     */
    async createSkill(data) {
        const {
            category_id,
            name,
            slug,
            proficiency_level,
            years_of_experience,
            icon,
            color,
            display_order,
            is_featured
        } = data;
        const finalSlug = await createSkillSlug({ name, slug });
        const query = `
            INSERT INTO skills (category_id, name, slug, proficiency_level, years_of_experience, icon, color, display_order, is_featured)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `;
        const result = await executeQuery(query, [
            category_id,
            name,
            finalSlug,
            proficiency_level ?? 50,
            years_of_experience ?? null,
            icon ?? null,
            color ?? null,
            display_order ?? 0,
            is_featured ?? false
        ]);
        return result.insertId;
    },

    /**
     * @description 스킬 모델의 기술 정보를 갱신한다.
     * @param {*} id 입력값
     * @param {*} data 입력값
     * @returns {Promise<any>} 처리 결과
     */
    async updateSkill(id, data) {
        const updateFields = [];
        const updateValues = [];
        const shouldUpdateSlug = data.slug !== undefined || data.name !== undefined;
        const finalSlug = shouldUpdateSlug
            ? await createSkillSlug({ name: data.name, slug: data.slug, id })
            : null;
        const allowedFields = {
            category_id: data.category_id,
            name: data.name,
            slug: shouldUpdateSlug ? finalSlug : undefined,
            proficiency_level: data.proficiency_level,
            years_of_experience: data.years_of_experience,
            icon: data.icon,
            color: data.color,
            display_order: data.display_order,
            is_featured: data.is_featured
        };

        for (const [field, value] of Object.entries(allowedFields)) {
            if (value !== undefined) {
                updateFields.push(`${field} = ?`);
                updateValues.push(value);
            }
        }

        if (updateFields.length === 0) {
            return await this.getSkillById(id);
        }

        updateFields.push('updated_at = NOW()');
        updateValues.push(id);

        const query = `UPDATE skills SET ${updateFields.join(', ')} WHERE id = ?`;
        await executeQuery(query, updateValues);
        return await this.getSkillById(id);
    },

    /**
     * @description 스킬 모델의 기술을 삭제한다.
     * @param {*} id 입력값
     * @returns {Promise<any>} 처리 결과
     */
    async deleteSkill(id) {
        await executeQuery('DELETE FROM skills WHERE id = ?', [id]);
    }
};
export {};
