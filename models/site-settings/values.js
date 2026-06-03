const serializeSettingValue = (value, type = 'string') => {
    if (value === null || value === undefined) {
        return null;
    }
    if (type === 'json') {
        return JSON.stringify(value);
    }
    if (type === 'boolean') {
        return value ? 'true' : 'false';
    }
    return String(value);
};

const parseSettingValue = (setting) => {
    let value = setting.setting_value;
    if (value === null || value === undefined) {
        return null;
    }

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
};

module.exports = {
    parseSettingValue,
    serializeSettingValue
};
