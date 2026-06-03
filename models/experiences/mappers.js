const hasOwn = (value, key) => Object.prototype.hasOwnProperty.call(value, key);

const normalizeNullableValue = (value) => (value === '' ? null : value);

const mapExperienceCompany = (experience) => {
    if (!experience) {
        return experience;
    }

    return {
        ...experience,
        company: experience.company_or_institution
    };
};

const mapExperienceList = (experiences) => experiences.map(mapExperienceCompany);

module.exports = {
    hasOwn,
    mapExperienceCompany,
    mapExperienceList,
    normalizeNullableValue
};
