const { executeQuery } = require('./common');

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
            proficiency_level,
            years_of_experience,
            icon,
            color,
            display_order,
            is_featured
        } = data;
        const query = `
            INSERT INTO skills (category_id, name, proficiency_level, years_of_experience, icon, color, display_order, is_featured)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `;
        const result = await executeQuery(query, [
            category_id,
            name,
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
        const allowedFields = {
            category_id: data.category_id,
            name: data.name,
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
