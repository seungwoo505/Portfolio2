const allowedAdminRoles = new Set(['super_admin', 'admin', 'editor']);
const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const isValidEmail = (value: unknown): boolean => (
    typeof value === 'string' && emailPattern.test(value.trim())
);

const isValidAdminRole = (value: unknown): boolean => (
    typeof value === 'string' && allowedAdminRoles.has(value)
);

const getPasswordByteLimitError = (password: unknown): string | null => (
    typeof password === 'string' && Buffer.byteLength(password, 'utf8') > 72
        ? '비밀번호는 UTF-8 기준 72바이트 이하여야 합니다.'
        : null
);

const assertPasswordByteLimit = (password: unknown): void => {
    const error = getPasswordByteLimitError(password);
    if (error) throw new Error(error);
};

const getPasswordPolicyError = (password: unknown): string | null => {
    if (typeof password !== 'string' || password.length === 0) {
        return '비밀번호를 입력해주세요.';
    }

    const byteLimitError = getPasswordByteLimitError(password);
    if (byteLimitError) return byteLimitError;

    if (password.length < 12) {
        return '비밀번호는 최소 12자 이상이어야 합니다.';
    }

    if (!/[A-Za-z]/.test(password) || !/[0-9]/.test(password)) {
        return '비밀번호는 영문과 숫자를 포함해야 합니다.';
    }

    return null;
};

module.exports = {
    allowedAdminRoles,
    assertPasswordByteLimit,
    getPasswordByteLimitError,
    getPasswordPolicyError,
    isValidAdminRole,
    isValidEmail
};

export {};
