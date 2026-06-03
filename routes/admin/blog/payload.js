const {
    getPlainBody,
    hasInvalidProvidedStringFields,
    trimStringFields
} = require('./common');

const blogRequiredStringFields = ['title', 'content'];

const normalizeBlogUpdatePayload = (req) => {
    const body = trimStringFields(getPlainBody(req), blogRequiredStringFields);

    if (Object.keys(body).length === 0) {
        return {
            error: '수정할 블로그 포스트 정보가 필요합니다.'
        };
    }

    if (hasInvalidProvidedStringFields(body, blogRequiredStringFields)) {
        return {
            error: '제목과 내용은 비어 있을 수 없습니다.'
        };
    }

    return { body };
};

module.exports = {
    normalizeBlogUpdatePayload
};
