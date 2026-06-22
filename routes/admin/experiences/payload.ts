const {
    getPlainBody,
    hasRequiredStringFields,
    trimStringFields
} = require('../../../utils/request-body');

const experienceStringFields = ['type', 'title', 'company', 'company_or_institution'];

const hasOwn = (value, key) => Object.prototype.hasOwnProperty.call(value, key);

const mapExperienceBody = (body) => {
    const mappedData = { ...body };

    if (hasOwn(body, 'company')) {
        mappedData.company_or_institution = body.company;
    } else if (hasOwn(body, 'company_or_institution')) {
        mappedData.company_or_institution = body.company_or_institution;
    }

    return mappedData;
};

const getExperiencePayload = (req) => (
    trimStringFields(getPlainBody(req), experienceStringFields)
);

const validateRequiredExperiencePayload = (body) => {
    if (!hasRequiredStringFields(body, ['type', 'title'])) {
        return '타입과 제목은 필수입니다.';
    }
    return null;
};

module.exports = {
    experienceStringFields,
    getExperiencePayload,
    mapExperienceBody,
    validateRequiredExperiencePayload
};
export {};
