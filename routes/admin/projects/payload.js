const normalizeUndefinedFields = (body) => {
    const normalizedData = {};

    Object.keys(body).forEach((key) => {
        normalizedData[key] = body[key] === undefined ? null : body[key];
    });

    return normalizedData;
};

module.exports = {
    normalizeUndefinedFields
};
