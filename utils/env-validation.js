const { parseIntegerEnv } = require('./env-number');

const placeholderPatterns = [
    /change[_-]?me/i,
    /your[_-\s]/i,
    /example\.com/i,
    /^password$/i,
    /^secret$/i
];

const productionRequiredVariables = [
    'DB_HOST',
    'DB_PORT',
    'DB_USER',
    'DB_PASSWORD',
    'DB_SCHEMA',
    'JWT_SECRET',
    'JWT_REFRESH_SECRET',
    'MY_HOST',
    'HTTPS_KEY',
    'HTTPS_CERT'
];

const bootstrapRequiredVariables = [
    'ADMIN_BOOTSTRAP_USERNAME',
    'ADMIN_BOOTSTRAP_EMAIL',
    'ADMIN_BOOTSTRAP_PASSWORD'
];

const valueOf = (env, name) => String(env[name] ?? '').trim();

const hasValue = (env, name) => valueOf(env, name).length > 0;

const isPlaceholderValue = (value) => placeholderPatterns.some((pattern) => pattern.test(String(value || '')));

const addPlaceholderFailure = (failures, env, name) => {
    const value = valueOf(env, name);
    if (value && isPlaceholderValue(value)) {
        failures.push(`${name} 값은 예시/placeholder가 아닌 실제 운영 값을 사용해야 합니다.`);
    }
};

const validateRequiredValues = (failures, env, variableNames) => {
    variableNames.forEach((name) => {
        if (!hasValue(env, name)) {
            failures.push(`${name} 환경 변수가 필요합니다.`);
            return;
        }

        addPlaceholderFailure(failures, env, name);
    });
};

const validateUrl = (failures, env, name) => {
    const value = valueOf(env, name);
    if (!value) {
        return;
    }

    try {
        const url = new URL(value);
        if (!['http:', 'https:'].includes(url.protocol)) {
            failures.push(`${name} 값은 http 또는 https URL이어야 합니다.`);
        }
        if (url.hostname === 'localhost' || url.hostname === '127.0.0.1') {
            failures.push(`${name} 값은 운영 환경에서 localhost를 사용할 수 없습니다.`);
        }
    } catch (_error) {
        failures.push(`${name} 값은 유효한 URL이어야 합니다.`);
    }
};

const validateSecret = (failures, env, name) => {
    const value = valueOf(env, name);
    if (!value) {
        return;
    }

    if (value.length < 32) {
        failures.push(`${name} 값은 최소 32자 이상이어야 합니다.`);
    }
};

const validateBootstrapCredentials = (failures, env) => {
    const hasBootstrapConfig = bootstrapRequiredVariables.some((name) => hasValue(env, name));
    if (!hasBootstrapConfig) {
        return;
    }

    validateRequiredValues(failures, env, bootstrapRequiredVariables);

    const email = valueOf(env, 'ADMIN_BOOTSTRAP_EMAIL');
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        failures.push('ADMIN_BOOTSTRAP_EMAIL 값은 유효한 이메일이어야 합니다.');
    }

    const password = valueOf(env, 'ADMIN_BOOTSTRAP_PASSWORD');
    if (password && password.length < 12) {
        failures.push('ADMIN_BOOTSTRAP_PASSWORD 값은 최소 12자 이상이어야 합니다.');
    }
};

const validateProductionEnv = (env = process.env) => {
    if (env.NODE_ENV !== 'production') {
        return {
            ok: true,
            errors: []
        };
    }

    const errors = [];
    validateRequiredValues(errors, env, productionRequiredVariables);
    validateSecret(errors, env, 'JWT_SECRET');
    validateSecret(errors, env, 'JWT_REFRESH_SECRET');
    validateUrl(errors, env, 'MY_HOST');
    validateBootstrapCredentials(errors, env);

    const dbPort = valueOf(env, 'DB_PORT');
    const dbPortNumber = parseIntegerEnv(dbPort, {
        fallback: null,
        min: 1,
        clamp: false
    });
    if (dbPort && dbPortNumber === null) {
        errors.push('DB_PORT 값은 1 이상의 정수여야 합니다.');
    }

    if (valueOf(env, 'JWT_SECRET') && valueOf(env, 'JWT_SECRET') === valueOf(env, 'JWT_REFRESH_SECRET')) {
        errors.push('JWT_SECRET과 JWT_REFRESH_SECRET은 서로 다른 값을 사용해야 합니다.');
    }

    return {
        ok: errors.length === 0,
        errors
    };
};

module.exports = {
    validateProductionEnv
};
