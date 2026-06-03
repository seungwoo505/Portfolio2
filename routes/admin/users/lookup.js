const { parsePositiveIntegerParam } = require('../../../utils/route-params');
const AdminUsers = require('../../../models/admin-users');

const buildUserRouteError = (statusCode, message) => ({
    error: {
        statusCode,
        message
    }
});

const parseUserIdParam = (value) => {
    const userId = parsePositiveIntegerParam(value);
    if (!userId) {
        return buildUserRouteError(400, '유효한 사용자 ID가 필요합니다.');
    }

    return { userId };
};

const findUserById = async (userId, notFoundMessage = '사용자를 찾을 수 없습니다.') => {
    const user = await AdminUsers.getById(userId);
    if (!user) {
        return buildUserRouteError(404, notFoundMessage);
    }

    return { user };
};

const ensureUserCanBeDeleted = (userId, adminId) => {
    if (userId === Number(adminId)) {
        return buildUserRouteError(400, '자신의 계정은 삭제할 수 없습니다.');
    }

    return {};
};

module.exports = {
    ensureUserCanBeDeleted,
    findUserById,
    parseUserIdParam
};
