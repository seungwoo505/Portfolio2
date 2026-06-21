type RequestLike = {
    body?: unknown;
} | null | undefined;

type PlainBody = Record<string, unknown>;

const hasOwn = (value: PlainBody, key: string): boolean => Object.prototype.hasOwnProperty.call(value, key);

const getPlainBody = (req: RequestLike): PlainBody => {
    const body = req?.body;
    return body && typeof body === 'object' && !Array.isArray(body) ? body as PlainBody : {};
};

const trimStringFields = (body: PlainBody, fields: string[]): PlainBody => {
    const normalizedBody = { ...body };

    fields.forEach((field) => {
        if (hasOwn(normalizedBody, field) && typeof normalizedBody[field] === 'string') {
            normalizedBody[field] = normalizedBody[field].trim();
        }
    });

    return normalizedBody;
};

const hasRequiredStringFields = (body: PlainBody, fields: string[]): boolean => (
    fields.every((field) => typeof body[field] === 'string' && body[field].trim().length > 0)
);

const hasInvalidProvidedStringFields = (body: PlainBody, fields: string[]): boolean => (
    fields.some((field) => (
        hasOwn(body, field)
        && (typeof body[field] !== 'string' || body[field].trim().length === 0)
    ))
);

module.exports = {
    getPlainBody,
    hasInvalidProvidedStringFields,
    hasRequiredStringFields,
    trimStringFields
};

export {};
