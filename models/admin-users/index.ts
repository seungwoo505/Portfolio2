const authMethods = require('./auth');
const permissionMethods = require('./permissions');
const sessionMethods = require('./sessions');
const tokenMethods = require('./tokens');
const userMethods = require('./users');

const AdminUsers = {
    _userPermissionColumn: undefined
};

Object.assign(AdminUsers, tokenMethods, sessionMethods, userMethods, authMethods, permissionMethods);

module.exports = AdminUsers;
export {};
