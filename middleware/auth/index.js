const { logActivity } = require('./activity');
const {
    requirePermission,
    requireRole,
    restrictToIPs
} = require('./authorization');
const { authenticateToken } = require('./token');

const adminOnly = [authenticateToken, requireRole(['super_admin', 'admin'])];
const superAdminOnly = [authenticateToken, requireRole('super_admin')];

module.exports = {
    authenticateToken,
    requirePermission,
    requireRole,
    logActivity,
    restrictToIPs,
    adminOnly,
    superAdminOnly
};
