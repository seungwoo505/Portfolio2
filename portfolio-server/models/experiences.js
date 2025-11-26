const { executeQuery, executeQuerySingle } = require('./db-utils');

const Experiences = {
    /**
     * @description Retrieves Experiences Model All.
     * @returns {Promise<any>} 처리 결과
     */
    async getAll() {
        const results = await executeQuery(`
            SELECT * FROM experiences 
            ORDER BY is_current DESC, end_date DESC, start_date DESC
        `);
        return results.map(experience => ({
            ...experience,
            company: experience.company_or_institution
        }));
    },

    /**
     * @description Retrieves Experiences Model By Type.
      * @param {*} type 입력값
     * @returns {Promise<any>} 처리 결과
     */
    async getByType(type) {
        const results = await executeQuery(`
            SELECT * FROM experiences 
            WHERE type = ?
            ORDER BY is_current DESC, end_date DESC, start_date DESC
        `, [type]);
        return results.map(experience => ({
            ...experience,
            company: experience.company_or_institution
        }));
    },

    /**
     * @description Retrieves Experiences Model By Id.
      * @param {*} id 입력값
     * @returns {Promise<any>} 처리 결과
     */
    async getById(id) {
        const result = await executeQuerySingle('SELECT * FROM experiences WHERE id = ?', [id]);
        if (result) {
            return {
                ...result,
                company: result.company_or_institution
            };
        }
        return result;
    },

    /**
     * @description create for Experiences Model.
      * @param {*} data 입력값
     * @returns {Promise<any>} 처리 결과
     */
    async create(data) {
        const { type, title, company_or_institution, location, description, start_date, end_date, is_current, display_order } = data;
        
        const params = [type, title, company_or_institution, location, description, start_date, end_date, is_current, display_order]
            .map(value => {
                if (value === undefined) return null;
                if (value === '') return null; // 빈 문자열도 null로 변환
                return value;
            });
        
        const query = `
            INSERT INTO experiences (type, title, company_or_institution, location, description, start_date, end_date, is_current, display_order)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `;
        const result = await executeQuery(query, params);
        return result.insertId;
    },

    /**
     * @description update for Experiences Model.
      * @param {*} id 입력값
      * @param {*} data 입력값
     * @returns {Promise<any>} 처리 결과
     */
    async update(id, data) {
        const { type, title, company_or_institution, location, description, start_date, end_date, is_current, display_order } = data;
        
        const params = [type, title, company_or_institution, location, description, start_date, end_date, is_current, display_order]
            .map(value => {
                if (value === undefined) return null;
                if (value === '') return null; // 빈 문자열도 null로 변환
                return value;
            });
        
        const query = `
            UPDATE experiences 
            SET type = COALESCE(?, type), 
                title = COALESCE(?, title), 
                company_or_institution = COALESCE(?, company_or_institution), 
                location = COALESCE(?, location), 
                description = COALESCE(?, description), 
                start_date = COALESCE(?, start_date), 
                end_date = COALESCE(?, end_date), 
                is_current = COALESCE(?, is_current), 
                display_order = COALESCE(?, display_order),
                updated_at = NOW()
            WHERE id = ?
        `;
        await executeQuery(query, [...params, id]);
        return await this.getById(id);
    },

    /**
     * @description delete for Experiences Model.
      * @param {*} id 입력값
     * @returns {Promise<any>} 처리 결과
     */
    async delete(id) {
        await executeQuery('DELETE FROM experiences WHERE id = ?', [id]);
    },

    async getCurrent() {
        return await executeQuery(`
            SELECT * FROM experiences 
            WHERE is_current = TRUE
            ORDER BY display_order ASC, start_date DESC
        `);
    },

    /**
     * @description Retrieves Experiences Model Work.
     * @returns {Promise<any>} 처리 결과
     */
    async getWork() {
        return await this.getByType('work');
    },

    /**
     * @description Retrieves Experiences Model Education.
     * @returns {Promise<any>} 처리 결과
     */
    async getEducation() {
        return await this.getByType('education');
    },

    /**
     * @description Retrieves Experiences Model Volunteer.
     * @returns {Promise<any>} 처리 결과
     */
    async getVolunteer() {
        return await this.getByType('volunteer');
    },

    /**
     * @description Retrieves Experiences Model Certifications.
     * @returns {Promise<any>} 처리 결과
     */
    async getCertifications() {
        return await this.getByType('certification');
    },

    /**
     * @description Updates Experiences Model Display Order.
      * @param {*} id 입력값
      * @param {*} displayOrder 입력값
     * @returns {Promise<any>} 처리 결과
     */
    async updateDisplayOrder(id, displayOrder) {
        await executeQuery('UPDATE experiences SET display_order = ?, updated_at = NOW() WHERE id = ?', [displayOrder, id]);
    },

    async getTimeline() {
        return await executeQuery(`
            SELECT *, 
                   CASE 
                       WHEN is_current = TRUE THEN '현재'
                       WHEN end_date IS NULL THEN '진행중'
                       ELSE DATE_FORMAT(end_date, '%Y.%m')
                   END as end_date_formatted,
                   DATE_FORMAT(start_date, '%Y.%m') as start_date_formatted
            FROM experiences 
            ORDER BY is_current DESC, 
                     COALESCE(end_date, CURDATE()) DESC, 
                     start_date DESC
        `);
    }
};

module.exports = Experiences;
