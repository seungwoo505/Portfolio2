const {
    getPlainBody,
    hasInvalidProvidedStringFields,
    hasRequiredStringFields,
    trimStringFields
} = require('../../../utils/request-body');

const tagStringFields = ['name', 'slug', 'description', 'color', 'type'];

const getTagPayload = (req) => trimStringFields(getPlainBody(req), tagStringFields);

const validateCreateTagPayload = (body) => {
    if (!hasRequiredStringFields(body, ['name'])) {
        return '태그 이름은 필수입니다.';
    }
    return null;
};

const validateUpdateTagPayload = (body) => {
    if (Object.keys(body).length === 0) {
        return '수정할 태그 정보가 필요합니다.';
    }

    if (hasInvalidProvidedStringFields(body, ['name'])) {
        return '태그 이름은 비어 있을 수 없습니다.';
    }

    return null;
};

module.exports = {
    getTagPayload,
    tagStringFields,
    validateCreateTagPayload,
    validateUpdateTagPayload
};
export {};
