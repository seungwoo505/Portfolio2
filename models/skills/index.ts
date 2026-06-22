const categoryMethods = require('./categories');
const mutationMethods = require('./mutations');
const queryMethods = require('./queries');

module.exports = {
    ...queryMethods,
    ...mutationMethods,
    ...categoryMethods
};
export {};
