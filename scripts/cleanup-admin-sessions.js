#!/usr/bin/env node

require('dotenv').config({ quiet: true });

const logger = require('../log');
const AdminUsers = require('../models/admin-users');

const retentionDays = Number.parseInt(process.env.ADMIN_SESSION_RETAIN_DAYS || '7', 10);

AdminUsers.cleanupExpiredSessions(retentionDays)
    .then((deletedCount) => {
        logger.info('관리자 세션 정리 완료', {
            deletedCount,
            retentionDays: Number.isInteger(retentionDays) ? retentionDays : 7
        });
    })
    .catch((error) => {
        logger.error('관리자 세션 정리 실패', {
            error: error.message,
            stack: error.stack
        });
        process.exit(1);
    });
