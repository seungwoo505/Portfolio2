const { executeQuery, executeQuerySingle } = require('../db-utils');
const {
    mapExperienceCompany,
    mapExperienceList
} = require('./mappers');

const getAll = async () => {
    const results = await executeQuery(`
        SELECT * FROM experiences
        ORDER BY is_current DESC, end_date DESC, start_date DESC
    `);
    return mapExperienceList(results);
};

const getByType = async (type) => {
    const results = await executeQuery(`
        SELECT * FROM experiences
        WHERE type = ?
        ORDER BY is_current DESC, end_date DESC, start_date DESC
    `, [type]);
    return mapExperienceList(results);
};

const getById = async (id) => {
    const result = await executeQuerySingle('SELECT * FROM experiences WHERE id = ?', [id]);
    return mapExperienceCompany(result);
};

const getCurrent = async () => (
    await executeQuery(`
        SELECT * FROM experiences
        WHERE is_current = TRUE
        ORDER BY display_order ASC, start_date DESC
    `)
);

const getWork = async () => await getByType('work');

const getEducation = async () => await getByType('education');

const getVolunteer = async () => await getByType('volunteer');

const getCertifications = async () => await getByType('certification');

module.exports = {
    getAll,
    getById,
    getByType,
    getCertifications,
    getCurrent,
    getEducation,
    getVolunteer,
    getWork
};
export {};
