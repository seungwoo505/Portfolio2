const { toBooleanOrNull } = require('./filter-values');

const normalizeSettingValue = (key, value, type) => {
    if (value === null) return { value };
    if (type === 'number') {
        const numberValue = typeof value === 'number' || (typeof value === 'string' && value.trim() !== '')
            ? Number(value) : NaN;
        if (!Number.isFinite(numberValue)) return { error: `${key} 설정 값은 숫자여야 합니다.` };
        return { value: numberValue };
    }
    if (type === 'boolean') {
        const booleanValue = toBooleanOrNull(value);
        if (booleanValue === null) return { error: `${key} 설정 값은 boolean이어야 합니다.` };
        return { value: booleanValue };
    }
    return { value };
};

module.exports = { normalizeSettingValue };
export {};
