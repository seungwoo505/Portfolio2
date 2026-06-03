const { logger, buildErrorLog } = require('../common');
const AdminUsers = require('../../../models/admin-users');
const { logActivity, superAdminOnly } = require('../../../middleware/auth');

const userCreateClientErrors = new Set([
    '이미 존재하는 사용자명 또는 이메일입니다.'
]);

module.exports = {
    AdminUsers,
    buildErrorLog,
    logger,
    logActivity,
    superAdminOnly,
    userCreateClientErrors
};
