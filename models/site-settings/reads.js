const {
    executeQuery,
    executeQuerySingle
} = require('./common');
const { parseSettingValue } = require('./values');

module.exports = {
    /**
     * @description 사이트 설정 모델의 전체 목록을 조회한다.
     * @param {*} public_only 입력값
     * @returns {Promise<any>} 처리 결과
     */
    async getAll(public_only = false) {
        const whereClause = public_only ? 'WHERE is_public = TRUE' : '';
        return await executeQuery(`SELECT * FROM site_settings ${whereClause} ORDER BY setting_key ASC`);
    },

    /**
     * @description 사이트 설정 모델에서 값을 조회한다.
     * @param {*} key 입력값
     * @returns {Promise<any>} 처리 결과
     */
    async get(key) {
        return await executeQuerySingle('SELECT * FROM site_settings WHERE setting_key = ?', [key]);
    },

    async getValue(key) {
        const setting = await this.get(key);
        if (!setting) return null;

        return parseSettingValue(setting);
    },

    async getPublicSettings() {
        const settings = await this.getAll(true);

        return settings.reduce((acc, setting) => {
            acc[setting.setting_key] = parseSettingValue(setting);
            return acc;
        }, {});
    },

    /**
     * @description 사이트 설정 모델의 모든 설정을 조회한다.
     * @returns {Promise<any>} 처리 결과
     */
    async getAllSettings() {
        const settings = await this.getAll(false);

        return settings.reduce((acc, setting) => {
            acc[setting.setting_key] = {
                value: parseSettingValue(setting),
                type: setting.setting_type,
                is_public: setting.is_public,
                description: setting.description,
                updated_at: setting.updated_at
            };
            return acc;
        }, {});
    },

    /**
     * @description 사이트 설정 모델에서 패턴으로 조회한다.
     * @param {*} pattern 입력값
     * @returns {Promise<any>} 처리 결과
     */
    async getByPattern(pattern) {
        return await executeQuery(`
            SELECT * FROM site_settings 
            WHERE setting_key LIKE ?
            ORDER BY setting_key ASC
        `, [`%${pattern}%`]);
    }
};
