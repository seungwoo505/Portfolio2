const mutations = require('./mutations');
const queries = require('./queries');
const usage = require('./usage');

module.exports = {
    ...queries,
    ...mutations,
    ...usage
};
export {};
