const {
    getPlainBody,
    hasInvalidProvidedStringFields,
    hasRequiredStringFields,
    trimStringFields
} = require('../../../utils/request-body');

const interestStringFields = ['title', 'description', 'icon', 'category'];

const getInterestPayload = (req) => trimStringFields(getPlainBody(req), interestStringFields);

const validateCreateInterestPayload = (body) => {
    if (!hasRequiredStringFields(body, ['title', 'category'])) {
        return '제목과 카테고리는 필수입니다.';
    }
    return null;
};

const validateUpdateInterestPayload = (body) => {
    if (Object.keys(body).length === 0) {
        return '수정할 관심사 정보가 필요합니다.';
    }

    if (hasInvalidProvidedStringFields(body, ['title', 'category'])) {
        return '제목과 카테고리는 비어 있을 수 없습니다.';
    }

    return null;
};

module.exports = {
    getInterestPayload,
    interestStringFields,
    validateCreateInterestPayload,
    validateUpdateInterestPayload
};
