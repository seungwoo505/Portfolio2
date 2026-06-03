const readMethods = require('./reads');
const writeMethods = require('./writes');

module.exports = {
    ...readMethods,
    ...writeMethods
};
