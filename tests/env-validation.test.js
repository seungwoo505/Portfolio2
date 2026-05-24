const test = require('node:test');
const assert = require('node:assert/strict');

const { validateProductionEnv } = require('../utils/env-validation');

const validProductionEnv = () => ({
    NODE_ENV: 'production',
    DB_HOST: 'db.internal',
    DB_PORT: '3306',
    DB_USER: 'portfolio_user',
    DB_PASSWORD: 'real-database-password',
    DB_SCHEMA: 'portfolio_db',
    JWT_SECRET: 'access-secret-with-more-than-32-characters',
    JWT_REFRESH_SECRET: 'refresh-secret-with-more-than-32-characters',
    MY_HOST: 'https://portfolio.example.net',
    HTTPS_KEY: '/etc/ssl/private.key',
    HTTPS_CERT: '/etc/ssl/certificate.crt'
});

test('production env validation is skipped outside production', () => {
    const result = validateProductionEnv({
        NODE_ENV: 'development'
    });

    assert.equal(result.ok, true);
    assert.deepEqual(result.errors, []);
});

test('production env validation accepts complete production settings', () => {
    const result = validateProductionEnv(validProductionEnv());

    assert.equal(result.ok, true);
    assert.deepEqual(result.errors, []);
});

test('production env validation rejects missing and placeholder values', () => {
    const result = validateProductionEnv({
        ...validProductionEnv(),
        DB_PASSWORD: 'change_me',
        HTTPS_CERT: ''
    });

    assert.equal(result.ok, false);
    assert.match(result.errors.join('\n'), /DB_PASSWORD/);
    assert.match(result.errors.join('\n'), /HTTPS_CERT/);
});

test('production env validation rejects weak secret configuration', () => {
    const result = validateProductionEnv({
        ...validProductionEnv(),
        JWT_SECRET: 'short-secret',
        JWT_REFRESH_SECRET: 'short-secret'
    });

    assert.equal(result.ok, false);
    assert.match(result.errors.join('\n'), /JWT_SECRET/);
    assert.match(result.errors.join('\n'), /JWT_REFRESH_SECRET/);
    assert.match(result.errors.join('\n'), /서로 다른 값/);
});

test('production env validation rejects weak bootstrap credentials when provided', () => {
    const result = validateProductionEnv({
        ...validProductionEnv(),
        ADMIN_BOOTSTRAP_USERNAME: 'admin',
        ADMIN_BOOTSTRAP_EMAIL: 'not-an-email',
        ADMIN_BOOTSTRAP_PASSWORD: 'change_me'
    });

    assert.equal(result.ok, false);
    assert.match(result.errors.join('\n'), /ADMIN_BOOTSTRAP_EMAIL/);
    assert.match(result.errors.join('\n'), /ADMIN_BOOTSTRAP_PASSWORD/);
});
