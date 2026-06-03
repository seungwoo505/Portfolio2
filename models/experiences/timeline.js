const { executeQuery } = require('../db-utils');

const getTimeline = async () => (
    await executeQuery(`
        SELECT *,
               CASE
                   WHEN is_current = TRUE THEN '현재'
                   WHEN end_date IS NULL THEN '진행중'
                   ELSE DATE_FORMAT(end_date, '%Y.%m')
               END as end_date_formatted,
               DATE_FORMAT(start_date, '%Y.%m') as start_date_formatted
        FROM experiences
        ORDER BY is_current DESC,
                 COALESCE(end_date, CURDATE()) DESC,
                 start_date DESC
    `)
);

module.exports = {
    getTimeline
};
