const formulaInjectionPattern = /^[\s]*[=+\-@]|\t|\r/;

const escapeCsvField = (value: unknown): string => {
    const stringValue = value === null || value === undefined ? '' : String(value);
    const safeValue = formulaInjectionPattern.test(stringValue)
        ? `'${stringValue}`
        : stringValue;

    return `"${safeValue.replace(/"/g, '""')}"`;
};

module.exports = {
    escapeCsvField
};

export {};
