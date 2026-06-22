const detailMethods = require('./detail');
const listMethods = require('./list');
const mutationMethods = require('./mutations');
const relationMethods = require('./relations');
const slugMethods = require('./slugs');

module.exports = Object.assign(
    {},
    slugMethods,
    listMethods,
    detailMethods,
    mutationMethods,
    relationMethods
);
export {};
