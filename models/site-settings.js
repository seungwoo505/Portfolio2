const { executeQuery, executeQuerySingle } = require('./db-utils');

const SiteSettings = {
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
        
        let value = setting.setting_value;
        if (setting.setting_type === 'boolean') {
            value = value === 'true';
        } else if (setting.setting_type === 'number') {
            value = Number(value);
        } else if (setting.setting_type === 'json') {
            try {
                value = JSON.parse(value);
            } catch (e) {
                value = setting.setting_value;
            }
        }
        
        return value;
    },

    /**
     * @description 사이트 설정 모델에 값을 저장한다.
      * @param {*} key 입력값
      * @param {*} value 입력값
      * @param {*} type 입력값
      * @param {*} is_public 입력값
      * @param {*} description 입력값
     * @returns {Promise<any>} 처리 결과
     */
    async set(key, value, type = 'string', is_public = false, description = null) {
        let stringValue = value;
        if (type === 'json') {
            stringValue = JSON.stringify(value);
        } else if (type === 'boolean') {
            stringValue = value ? 'true' : 'false';
        } else {
            stringValue = String(value);
        }

        const query = `
            INSERT INTO site_settings (setting_key, setting_value, setting_type, is_public, description)
            VALUES (?, ?, ?, ?, ?)
            ON DUPLICATE KEY UPDATE 
            setting_value = VALUES(setting_value),
            setting_type = VALUES(setting_type),
            is_public = VALUES(is_public),
            description = COALESCE(VALUES(description), description),
            updated_at = NOW()
        `;
        await executeQuery(query, [key, stringValue, type, is_public, description]);
        return await this.get(key);
    },

    /**
     * @description 사이트 설정 모델의 정보를 수정한다.
      * @param {*} key 입력값
      * @param {*} updates 입력값
     * @returns {Promise<any>} 처리 결과
     */
    async update(key, updates) {
        const { setting_value, setting_type, is_public, description } = updates;
        
        let stringValue = setting_value;
        if (setting_type === 'json' && typeof setting_value !== 'string') {
            stringValue = JSON.stringify(setting_value);
        } else if (setting_type === 'boolean') {
            stringValue = setting_value ? 'true' : 'false';
        } else if (setting_value !== undefined) {
            stringValue = String(setting_value);
        }

        const query = `
            UPDATE site_settings 
            SET setting_value = COALESCE(?, setting_value),
                setting_type = COALESCE(?, setting_type),
                is_public = COALESCE(?, is_public),
                description = COALESCE(?, description),
                updated_at = NOW()
            WHERE setting_key = ?
        `;
        await executeQuery(query, [stringValue, setting_type, is_public, description, key]);
        return await this.get(key);
    },

    /**
     * @description 사이트 설정 모델에서 항목을 삭제한다.
      * @param {*} key 입력값
     * @returns {Promise<any>} 처리 결과
     */
    async delete(key) {
        await executeQuery('DELETE FROM site_settings WHERE setting_key = ?', [key]);
    },

    async getPublicSettings() {
        const settings = await this.getAll(true);
        
        return settings.reduce((acc, setting) => {
            let value = setting.setting_value;
            
            if (setting.setting_type === 'boolean') {
                value = value === 'true';
            } else if (setting.setting_type === 'number') {
                value = Number(value);
            } else if (setting.setting_type === 'json') {
                try {
                    value = JSON.parse(value);
                } catch (e) {
                    value = setting.setting_value;
                }
            }
            
            acc[setting.setting_key] = value;
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
            let value = setting.setting_value;
            
            if (setting.setting_type === 'boolean') {
                value = value === 'true';
            } else if (setting.setting_type === 'number') {
                value = Number(value);
            } else if (setting.setting_type === 'json') {
                try {
                    value = JSON.parse(value);
                } catch (e) {
                    value = setting.setting_value;
                }
            }
            
            acc[setting.setting_key] = {
                value,
                type: setting.setting_type,
                is_public: setting.is_public,
                description: setting.description,
                updated_at: setting.updated_at
            };
            return acc;
        }, {});
    },

    /**
     * @description 사이트 설정 모델에 여러 항목을 한 번에 저장한다.
      * @param {*} settings 입력값
     * @returns {Promise<any>} 처리 결과
     */
    async setBulk(settings) {
        for (const { key, value, type, is_public, description } of settings) {
            await this.set(key, value, type, is_public, description);
        }
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

module.exports = SiteSettings;
