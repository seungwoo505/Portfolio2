const {
    createQueryContext,
    defaultQueryContext,
    executeQuery,
    executeTransaction,
    hasOwn
} = require('./common');
const { serializeSettingValue } = require('./values');

module.exports = {
    /**
     * @description 사이트 설정 모델에 값을 저장한다.
     * @param {*} key 입력값
     * @param {*} value 입력값
     * @param {*} type 입력값
     * @param {*} is_public 입력값
     * @param {*} description 입력값
     * @returns {Promise<any>} 처리 결과
     */
    async set(key, value, type = 'string', is_public = false, description = null, db = defaultQueryContext) {
        const stringValue = serializeSettingValue(value, type);
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
        await db.query(query, [key, stringValue, type, is_public, description]);
        return await db.querySingle('SELECT * FROM site_settings WHERE setting_key = ?', [key]);
    },

    /**
     * @description 여러 사이트 설정을 하나의 트랜잭션으로 저장한다.
     * @param {*} settings 입력값
     * @returns {Promise<any>} 처리 결과
     */
    async setMany(settings) {
        return await executeTransaction(async (connection) => {
            const db = createQueryContext(connection);
            const updatedSettings = [];

            for (const [key, config] of Object.entries(settings)) {
                const setting = await this.set(
                    key,
                    config.value,
                    config.type,
                    config.is_public,
                    config.description,
                    db
                );
                updatedSettings.push(setting);
            }

            return updatedSettings;
        });
    },

    /**
     * @description 사이트 설정 모델의 정보를 수정한다.
     * @param {*} key 입력값
     * @param {*} updates 입력값
     * @returns {Promise<any>} 처리 결과
     */
    async update(key, updates) {
        const updateFields = [];
        const updateValues = [];
        const settingValueProvided = hasOwn(updates, 'setting_value') && updates.setting_value !== undefined;
        const settingType = hasOwn(updates, 'setting_type') ? updates.setting_type : undefined;

        if (settingValueProvided) {
            let stringValue = updates.setting_value;
            if (updates.setting_value !== null) {
                if (settingType === 'json' && typeof updates.setting_value !== 'string') {
                    stringValue = JSON.stringify(updates.setting_value);
                } else if (settingType === 'boolean') {
                    stringValue = updates.setting_value ? 'true' : 'false';
                } else {
                    stringValue = String(updates.setting_value);
                }
            }
            updateFields.push('setting_value = ?');
            updateValues.push(stringValue);
        }

        if (hasOwn(updates, 'setting_type') && updates.setting_type !== undefined) {
            updateFields.push('setting_type = ?');
            updateValues.push(updates.setting_type);
        }
        if (hasOwn(updates, 'is_public') && updates.is_public !== undefined) {
            updateFields.push('is_public = ?');
            updateValues.push(updates.is_public);
        }
        if (hasOwn(updates, 'description') && updates.description !== undefined) {
            updateFields.push('description = ?');
            updateValues.push(updates.description);
        }

        if (updateFields.length === 0) {
            return await this.get(key);
        }

        updateFields.push('updated_at = NOW()');
        updateValues.push(key);

        const query = `UPDATE site_settings SET ${updateFields.join(', ')} WHERE setting_key = ?`;
        await executeQuery(query, updateValues);
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

    /**
     * @description 사이트 설정 모델에 여러 항목을 한 번에 저장한다.
     * @param {*} settings 입력값
     * @returns {Promise<any>} 처리 결과
     */
    async setBulk(settings) {
        for (const { key, value, type, is_public, description } of settings) {
            await this.set(key, value, type, is_public, description);
        }
    }
};
