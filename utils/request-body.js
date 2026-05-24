const hasOwn = (value, key) => Object.prototype.hasOwnProperty.call(value, key);

const getPlainBody = (req) => {
    const body = req?.body;
    return body && typeof body === 'object' && !Array.isArray(body) ? body : {};
};

const trimStringFields = (body, fields) => {
    const normalizedBody = { ...body };

    fields.forEach((field) => {
        if (hasOwn(normalizedBody, field) && typeof normalizedBody[field] === 'string') {
            normalizedBody[field] = normalizedBody[field].trim();
        }
    });

    return normalizedBody;
};

const hasRequiredStringFields = (body, fields) => (
    fields.every((field) => typeof body[field] === 'string' && body[field].trim().length > 0)
);

const hasInvalidProvidedStringFields = (body, fields) => (
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
