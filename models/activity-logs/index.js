const maintenanceMethods = require('./maintenance');
const queryMethods = require('./queries');
const statMethods = require('./stats');
const writeMethods = require('./writes');

class ActivityLogs {}

Object.assign(
    ActivityLogs.prototype,
    writeMethods,
    queryMethods,
    statMethods,
    maintenanceMethods
);

module.exports = new ActivityLogs();
