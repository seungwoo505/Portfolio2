const { toBooleanOrNull, toStringValue } = require('../../../utils/filter-values');

const hasOwn = (value, key) => Object.prototype.hasOwnProperty.call(value, key);

const parseNumber = (value, { integer = false, min = 0, max = null } = {}) => {
    if (value === null) {
        return null;
    }
    if (value === undefined) {
        return undefined;
    }

    let parsed;
    if (typeof value === 'number') {
        parsed = value;
    } else if (typeof value === 'string') {
        const normalizedValue = value.trim();
        if (normalizedValue === '') {
            return null;
        }
        const numberPattern = integer
            ? /^-?\d+$/
            : /^-?(?:\d+|\d+\.\d+|\.\d+)$/;
        if (!numberPattern.test(normalizedValue)) {
            return undefined;
        }
        parsed = Number(normalizedValue);
    } else {
        return undefined;
    }

    if (
        !Number.isFinite(parsed)
        || (integer && !Number.isInteger(parsed))
        || parsed < min
        || (max !== null && parsed > max)
    ) {
        return undefined;
    }

    return parsed;
};

const setStringField = (payload, body, field, { nullable = true } = {}) => {
    if (!hasOwn(body, field)) {
        return null;
    }

    const value = body[field] === null ? null : toStringValue(body[field]).trim();
    if (value === '' && nullable) {
        payload[field] = null;
        return null;
    }
    if (value === '') {
        return `${field} 값이 필요합니다.`;
    }

    payload[field] = value;
    return null;
};

const normalizeSkillPayload = (body: Record<string, any> = {}, { requireRequired = false } = {}) => {
    const payload: Record<string, any> = {};

    if (requireRequired && !hasOwn(body, 'name')) {
        return { error: '기술명을 입력해주세요.' };
    }
    if (requireRequired || hasOwn(body, 'name')) {
        const nameError = setStringField(payload, body, 'name', { nullable: false });
        if (nameError) {
            return { error: '기술명을 입력해주세요.' };
        }
    }

    if (requireRequired || hasOwn(body, 'category_id')) {
        const categoryId = parseNumber(body.category_id, { integer: true, min: 1 });
        if (categoryId === undefined || categoryId === null) {
            return { error: '유효한 카테고리를 선택해주세요.' };
        }
        payload.category_id = categoryId;
    }

    if (hasOwn(body, 'proficiency_level')) {
        const proficiencyLevel = parseNumber(body.proficiency_level, { integer: true, min: 0, max: 100 });
        if (proficiencyLevel === undefined || proficiencyLevel === null) {
            return { error: '숙련도는 0부터 100 사이의 숫자여야 합니다.' };
        }
        payload.proficiency_level = proficiencyLevel;
    } else if (requireRequired) {
        payload.proficiency_level = 50;
    }

    if (hasOwn(body, 'years_of_experience')) {
        const yearsOfExperience = parseNumber(body.years_of_experience, { min: 0 });
        if (yearsOfExperience === undefined) {
            return { error: '경력 연수는 0 이상의 숫자여야 합니다.' };
        }
        payload.years_of_experience = yearsOfExperience;
    } else if (requireRequired) {
        payload.years_of_experience = null;
    }

    for (const field of ['slug', 'icon', 'color']) {
        const error = setStringField(payload, body, field);
        if (error) {
            return { error };
        }
        if (requireRequired && ['icon', 'color'].includes(field) && !hasOwn(payload, field)) {
            payload[field] = null;
        }
    }

    if (hasOwn(body, 'display_order')) {
        const displayOrder = parseNumber(body.display_order, { integer: true, min: 0 });
        if (displayOrder === undefined || displayOrder === null) {
            return { error: '표시 순서는 0 이상의 숫자여야 합니다.' };
        }
        payload.display_order = displayOrder;
    } else if (requireRequired) {
        payload.display_order = 0;
    }

    if (hasOwn(body, 'is_featured')) {
        const isFeatured = toBooleanOrNull(body.is_featured);
        if (isFeatured === null) {
            return { error: '추천 상태는 boolean 값이어야 합니다.' };
        }
        payload.is_featured = isFeatured;
    } else if (requireRequired) {
        payload.is_featured = false;
    }

    return { data: payload };
};

module.exports = {
    hasOwn,
    normalizeSkillPayload,
    parseNumber,
    setStringField,
    toBooleanOrNull,
    toStringValue
};
export {};
