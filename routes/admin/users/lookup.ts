type UserRouteError = {
    statusCode: number;
    message: string;
};

type UserRouteErrorResult = {
    error: UserRouteError;
};

type UserIdResult = UserRouteErrorResult | {
    userId: number;
};

type UserLookupResult = UserRouteErrorResult | {
    user: unknown;
};

const { parsePositiveIntegerParam } = require('../../../utils/route-params');
const AdminUsers = require('../../../models/admin-users');

const buildUserRouteError = (statusCode: number, message: string): UserRouteErrorResult => ({
    error: {
        statusCode,
        message
    }
});

const parseUserIdParam = (value: unknown): UserIdResult => {
    const userId = parsePositiveIntegerParam(value);
    if (!userId) {
        return buildUserRouteError(400, '유효한 사용자 ID가 필요합니다.');
    }

    return { userId };
};

const findUserById = async (
    userId: number,
    notFoundMessage = '사용자를 찾을 수 없습니다.'
): Promise<UserLookupResult> => {
    const user = await AdminUsers.getById(userId);
    if (!user) {
        return buildUserRouteError(404, notFoundMessage);
    }

    return { user };
};

const ensureUserCanBeDeleted = (userId: number, adminId: number | string | undefined): Partial<UserRouteErrorResult> => {
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

export {};
