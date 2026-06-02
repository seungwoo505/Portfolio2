const { logger, buildErrorLog } = require('../common');
const AdminUsers = require('../../../models/admin-users');
const { logActivity, superAdminOnly } = require('../../../middleware/auth');
const { toBooleanOrNull } = require('../../../utils/filter-values');
const { parsePositiveIntegerParam } = require('../../../utils/route-params');
const {
    getPlainBody,
    hasInvalidProvidedStringFields,
    hasRequiredStringFields,
    trimStringFields
} = require('../../../utils/request-body');
const {
    getPasswordPolicyError,
    isValidAdminRole,
    isValidEmail
} = require('../../../utils/admin-validation');

const userStringFields = ['username', 'email', 'full_name', 'role'];
const normalizeUserUpdateBody = (body) => {
    const normalizedBody = trimStringFields(body, userStringFields);

    if (Object.prototype.hasOwnProperty.call(normalizedBody, 'is_active')) {
        normalizedBody.is_active = toBooleanOrNull(normalizedBody.is_active);
    }

    return normalizedBody;
};
const userCreateClientErrors = new Set([
    '이미 존재하는 사용자명 또는 이메일입니다.'
]);

module.exports = {
    AdminUsers,
    buildErrorLog,
    getPasswordPolicyError,
    getPlainBody,
    hasInvalidProvidedStringFields,
    hasRequiredStringFields,
    isValidAdminRole,
    isValidEmail,
    logger,
    logActivity,
    normalizeUserUpdateBody,
    parsePositiveIntegerParam,
    superAdminOnly,
    trimStringFields,
    userCreateClientErrors,
    userStringFields
};
