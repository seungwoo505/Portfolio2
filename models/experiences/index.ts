const mutations = require('./mutations');
const queries = require('./queries');
const timeline = require('./timeline');

module.exports = {
    ...queries,
    ...mutations,
    ...timeline
};
export {};
