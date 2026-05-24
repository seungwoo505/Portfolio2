const allowedAdminRoles = new Set(['super_admin', 'admin', 'editor']);
const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const isValidEmail = (value) => (
    typeof value === 'string' && emailPattern.test(value.trim())
);

const isValidAdminRole = (value) => (
    typeof value === 'string' && allowedAdminRoles.has(value)
);

const getPasswordPolicyError = (password) => {
    if (typeof password !== 'string' || password.length === 0) {
        return '비밀번호를 입력해주세요.';
    }

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
    getPasswordPolicyError,
    isValidAdminRole,
    isValidEmail
};
