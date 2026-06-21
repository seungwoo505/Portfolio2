const basicMethods = require('./basic');
const batchMethods = require('./batch');
const invalidationMethods = require('./invalidation');
const loaderMethods = require('./loader');
const lockMethods = require('./locks');

module.exports = {
    ...basicMethods,
    ...invalidationMethods,
    ...loaderMethods,
    ...lockMethods,
    ...batchMethods
};

export {};
