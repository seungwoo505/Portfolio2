import type { Request } from 'express';

const {
    getPasswordPolicyError,
    isValidAdminRole,
    isValidEmail
} = require('../../../utils/admin-validation');
const { toBooleanOrNull } = require('../../../utils/filter-values');
const {
    getPlainBody,
    hasInvalidProvidedStringFields,
    hasRequiredStringFields,
    trimStringFields
} = require('../../../utils/request-body');

const userStringFields = ['username', 'email', 'full_name', 'role'];
const userUpdateRequiredStringFields = ['username', 'email', 'role'];

type UserPayload = Record<string, unknown>;

type CreateUserPayload = {
    username: unknown;
    email: unknown;
    password: unknown;
    full_name: unknown;
    role: unknown;
};

const getCreateUserPayload = (req: Request): CreateUserPayload => {
    const body = trimStringFields(getPlainBody(req), userStringFields);
    return {
        username: body.username,
        email: body.email,
        password: body.password,
        full_name: body.full_name,
        role: body.role || 'admin'
    };
};

const validateCreateUserPayload = ({ username, email, password, role }: CreateUserPayload): string | null => {
    if (!hasRequiredStringFields({ username, email, password }, ['username', 'email', 'password'])) {
        return '사용자명, 이메일, 비밀번호는 필수입니다.';
    }

    if (!isValidEmail(email)) {
        return '올바른 이메일 형식이 아닙니다.';
    }

    if (!isValidAdminRole(role)) {
        return '관리자 역할이 올바르지 않습니다.';
    }

    return getPasswordPolicyError(password);
};

const getUpdateUserPayload = (req: Request): UserPayload => {
    const body = trimStringFields(getPlainBody(req), userStringFields);

    if (Object.prototype.hasOwnProperty.call(body, 'is_active')) {
        body.is_active = toBooleanOrNull(body.is_active);
    }

    return body;
};

const validateUpdateUserPayload = (body: UserPayload): string | null => {
    if (Object.keys(body).length === 0) {
        return '수정할 관리자 정보가 필요합니다.';
    }

    if (hasInvalidProvidedStringFields(body, userUpdateRequiredStringFields)) {
        return '사용자명, 이메일, 역할은 비어 있을 수 없습니다.';
    }

    if (body.email && !isValidEmail(body.email)) {
        return '올바른 이메일 형식이 아닙니다.';
    }

    if (body.role && !isValidAdminRole(body.role)) {
        return '관리자 역할이 올바르지 않습니다.';
    }

    if (Object.prototype.hasOwnProperty.call(body, 'is_active') && body.is_active === null) {
        return '활성 상태는 boolean 값이어야 합니다.';
    }

    if (Object.prototype.hasOwnProperty.call(body, 'password')) {
        const passwordPolicyError = getPasswordPolicyError(body.password);
        if (passwordPolicyError) {
            return passwordPolicyError;
        }
    }

    return null;
};

module.exports = {
    getCreateUserPayload,
    getUpdateUserPayload,
    validateCreateUserPayload,
    validateUpdateUserPayload
};
