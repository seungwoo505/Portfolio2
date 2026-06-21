import type { RequestHandler } from 'express';

const { logActivity } = require('./activity');
const {
    requirePermission,
    requireRole,
    restrictToIPs
} = require('./authorization');
const { authenticateToken } = require('./token');

const adminOnly: RequestHandler[] = [authenticateToken, requireRole(['super_admin', 'admin'])];
const superAdminOnly: RequestHandler[] = [authenticateToken, requireRole('super_admin')];

module.exports = {
    authenticateToken,
    requirePermission,
    requireRole,
    logActivity,
    restrictToIPs,
    adminOnly,
    superAdminOnly
};
