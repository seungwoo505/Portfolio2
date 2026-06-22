import type { Request } from 'express';

const {
    getPlainBody,
    hasInvalidProvidedStringFields,
    trimStringFields
} = require('./common');

type BlogPayload = Record<string, unknown>;

type BlogUpdatePayloadResult = {
    error: string;
} | {
    body: BlogPayload;
};

const hasUsableContent = (body: BlogPayload): boolean => (
    (typeof body.content === 'string' && body.content.trim().length > 0)
    || (typeof body.content_text === 'string' && body.content_text.trim().length > 0)
);

const normalizeBlogContentFields = (body: BlogPayload): BlogPayload => {
    const normalizedBody = trimStringFields(body, ['title', 'content', 'content_text']);

    if (
        (typeof normalizedBody.content !== 'string' || normalizedBody.content.trim().length === 0)
        && typeof normalizedBody.content_text === 'string'
        && normalizedBody.content_text.trim().length > 0
    ) {
        normalizedBody.content = normalizedBody.content_text;
    }

    return normalizedBody;
};

const normalizeBlogUpdatePayload = (req: Request): BlogUpdatePayloadResult => {
    const body = normalizeBlogContentFields(getPlainBody(req));

    if (Object.keys(body).length === 0) {
        return {
            error: '수정할 블로그 포스트 정보가 필요합니다.'
        };
    }

    if (hasInvalidProvidedStringFields(body, ['title'])) {
        return {
            error: '제목과 내용은 비어 있을 수 없습니다.'
        };
    }

    if (Object.prototype.hasOwnProperty.call(body, 'content') && !hasUsableContent(body)) {
        return {
            error: '제목과 내용은 비어 있을 수 없습니다.'
        };
    }

    return { body };
};

module.exports = {
    hasUsableContent,
    normalizeBlogContentFields,
    normalizeBlogUpdatePayload
};
