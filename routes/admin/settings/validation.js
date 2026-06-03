const { toBooleanOrNull } = require('../../../utils/filter-values');

const allowedSettingTypes = new Set(['string', 'number', 'boolean', 'json']);
const settingKeyMaxLength = 120;
const hasOwn = (value, key) => Object.prototype.hasOwnProperty.call(value, key);

const normalizeSettingConfig = (key, config) => {
    const settingKey = key.trim();
    if (!settingKey || settingKey.length > settingKeyMaxLength) {
        return {
            error: `설정 key는 1자 이상 ${settingKeyMaxLength}자 이하여야 합니다.`
        };
    }

    if (!config || typeof config !== 'object' || Array.isArray(config)) {
        return {
            error: '각 설정은 유효한 key와 설정 객체를 가져야 합니다.'
        };
    }

    if (!hasOwn(config, 'value')) {
        return {
            error: `${settingKey} 설정에는 value가 필요합니다.`
        };
    }

    const type = hasOwn(config, 'type')
        ? String(config.type ?? '').trim().toLowerCase()
        : 'string';
    if (!allowedSettingTypes.has(type)) {
        return {
            error: `${settingKey} 설정 타입은 string, number, boolean, json 중 하나여야 합니다.`
        };
    }

    let value = config.value;
    if (type === 'number' && value !== null) {
        if (typeof value === 'string' && value.trim() === '') {
            return {
                error: `${settingKey} 설정 값은 숫자여야 합니다.`
            };
        }
        const numberValue = Number(value);
        if (!Number.isFinite(numberValue)) {
            return {
                error: `${settingKey} 설정 값은 숫자여야 합니다.`
            };
        }
        value = numberValue;
    }

    if (type === 'boolean' && value !== null) {
        const booleanValue = toBooleanOrNull(value);
        if (booleanValue === null) {
            return {
                error: `${settingKey} 설정 값은 boolean이어야 합니다.`
            };
        }
        value = booleanValue;
    }

    let isPublic;
    if (hasOwn(config, 'is_public')) {
        isPublic = toBooleanOrNull(config.is_public);
        if (isPublic === null) {
            return {
                error: `${settingKey} 공개 여부는 boolean이어야 합니다.`
            };
        }
    }

    let description = null;
    if (hasOwn(config, 'description')) {
        if (config.description !== null && config.description !== undefined && typeof config.description !== 'string') {
            return {
                error: `${settingKey} 설명은 문자열이어야 합니다.`
            };
        }
        description = typeof config.description === 'string' ? config.description.trim() : null;
    }

    return {
        key: settingKey,
        config: {
            value,
            type,
            is_public: isPublic,
            description
        }
    };
};

const normalizeSettingsPayload = (settings) => {
    if (!settings || typeof settings !== 'object' || Array.isArray(settings)) {
        return {
            error: 'settings 객체가 필요합니다.'
        };
    }

    const normalizedSettings = {};
    for (const [key, config] of Object.entries(settings)) {
        const result = normalizeSettingConfig(key, config);
        if (result.error) {
            return {
                error: result.error
            };
        }

        normalizedSettings[result.key] = result.config;
    }

    return {
        settings: normalizedSettings
    };
};

module.exports = {
    normalizeSettingConfig,
    normalizeSettingsPayload
};
