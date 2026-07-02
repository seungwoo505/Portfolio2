const {
    getPlainBody,
    hasInvalidProvidedStringFields,
    hasRequiredStringFields,
    trimStringFields
} = require('../../../../utils/request-body');

const socialLinkStringFields = ['platform', 'label', 'url'];
const socialLinkRequiredStringFields = ['platform', 'url'];

const getSocialLinkPayload = (req) => (
    trimStringFields(getPlainBody(req), socialLinkStringFields)
);

const validateCreateSocialLinkPayload = (body) => {
    if (!hasRequiredStringFields(body, socialLinkRequiredStringFields)) {
        return '플랫폼과 URL은 필수입니다.';
    }

    return null;
};

const validateUpdateSocialLinkPayload = (body) => {
    if (Object.keys(body).length === 0) {
        return '수정할 소셜 링크 정보가 필요합니다.';
    }

    if (hasInvalidProvidedStringFields(body, socialLinkRequiredStringFields)) {
        return '플랫폼과 URL은 비어 있을 수 없습니다.';
    }

    return null;
};

module.exports = {
    getSocialLinkPayload,
    validateCreateSocialLinkPayload,
    validateUpdateSocialLinkPayload
};
export {};
