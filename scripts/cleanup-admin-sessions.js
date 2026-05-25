#!/usr/bin/env node

require('dotenv').config({ quiet: true });

const logger = require('../log');
const AdminUsers = require('../models/admin-users');
const { parseIntegerEnv } = require('../utils/env-number');

const retentionDays = parseIntegerEnv(process.env.ADMIN_SESSION_RETAIN_DAYS, {
    fallback: 7,
    min: 0,
    clamp: false
});

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
