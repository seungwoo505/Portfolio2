const detailMethods = require('./detail');
const listMethods = require('./list');
const mutationMethods = require('./mutations');
const projectMethods = require('./projects');
const searchMethods = require('./search');
const tagMethods = require('./tags');

module.exports = Object.assign(
    {},
    listMethods,
    detailMethods,
    searchMethods,
    mutationMethods,
    projectMethods,
    tagMethods
);
export {};
