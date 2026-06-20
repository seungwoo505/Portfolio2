const test = require('node:test');
const assert = require('node:assert/strict');
const bcrypt = require('bcryptjs');
const { createAdminUsersFixture } = require('./helpers/admin-auth-fixture');

test('AdminUsers.login creates a server session with a hashed refresh token', async () => {
    const { AdminUsers, sessions } = await createAdminUsersFixture();

    const result = await AdminUsers.login('admin', 'correct-password', '127.0.0.1', 'unit-agent');
    const accessPayload = AdminUsers.verifyToken(result.token);
    const refreshPayload = AdminUsers.verifyRefreshToken(result.refreshToken);

    assert.equal(result.user.password_hash, undefined);
    assert.equal(sessions.length, 1);
    assert.equal(sessions[0].session_id, accessPayload.sid);
    assert.equal(refreshPayload.sid, accessPayload.sid);
    assert.equal(sessions[0].admin_id, 1);
    assert.equal(sessions[0].ip_address, '127.0.0.1');
    assert.equal(sessions[0].user_agent, 'unit-agent');
    assert.notEqual(sessions[0].refresh_token_hash, result.refreshToken);
    assert.equal(sessions[0].refresh_token_hash, AdminUsers.hashToken(result.refreshToken));
});

test('AdminUsers.verifyRefreshSession checks the stored hash and marks usage', async () => {
    const { AdminUsers, sessions } = await createAdminUsersFixture();

    const { refreshToken } = await AdminUsers.login('admin', 'correct-password', '127.0.0.1', 'unit-agent');
    const decoded = AdminUsers.verifyRefreshToken(refreshToken);
    const session = await AdminUsers.verifyRefreshSession(refreshToken, decoded);

    assert.equal(session.session_id, decoded.sid);
    assert.ok(sessions[0].last_used_at instanceof Date);

    await assert.rejects(
        () => AdminUsers.verifyRefreshSession('wrong-refresh-token', decoded),
        /Refresh Token 세션/
    );
});

test('AdminUsers.rotateRefreshSession replaces the stored refresh token hash', async () => {
    const { AdminUsers, sessions } = await createAdminUsersFixture();

    const { user, refreshToken } = await AdminUsers.login('admin', 'correct-password', '127.0.0.1', 'unit-agent');
    const decoded = AdminUsers.verifyRefreshToken(refreshToken);
    const newRefreshToken = await AdminUsers.rotateRefreshSession(refreshToken, decoded, user, '127.0.0.1');

    assert.notEqual(newRefreshToken, refreshToken);
    assert.equal(sessions[0].refresh_token_hash, AdminUsers.hashToken(newRefreshToken));
    assert.notEqual(sessions[0].refresh_token_hash, AdminUsers.hashToken(refreshToken));
    assert.equal(AdminUsers.verifyRefreshToken(newRefreshToken).sid, decoded.sid);

    await assert.rejects(
        () => AdminUsers.verifyRefreshSession(refreshToken, decoded),
        /Refresh Token 세션/
    );
});

test('AdminUsers.logout revokes the active session', async () => {
    const { AdminUsers, sessions } = await createAdminUsersFixture();

    const { token } = await AdminUsers.login('admin', 'correct-password', '127.0.0.1', 'unit-agent');
    const decoded = AdminUsers.verifyToken(token);

    await AdminUsers.assertActiveSession(decoded.sid, decoded.id);
    await AdminUsers.logout(token);

    assert.ok(sessions[0].revoked_at instanceof Date);
    await assert.rejects(
        () => AdminUsers.assertActiveSession(decoded.sid, decoded.id),
        /세션이 만료되었거나 로그아웃/
    );
});

test('AdminUsers.changePassword revokes other active sessions for the admin', async () => {
    const { AdminUsers, sessions } = await createAdminUsersFixture();

    const firstLogin = await AdminUsers.login('admin', 'correct-password', '127.0.0.1', 'first-agent');
    const secondLogin = await AdminUsers.login('admin', 'correct-password', '127.0.0.1', 'second-agent');
    const currentSessionId = AdminUsers.verifyToken(firstLogin.token).sid;
    const otherSessionId = AdminUsers.verifyToken(secondLogin.token).sid;

    await AdminUsers.changePassword(1, 'correct-password', 'new-password', currentSessionId);

    assert.equal(sessions.find((session) => session.session_id === currentSessionId).revoked_at, null);
    assert.ok(sessions.find((session) => session.session_id === otherSessionId).revoked_at instanceof Date);
});

test('AdminUsers.cleanupExpiredSessions removes expired and old revoked sessions', async () => {
    const { AdminUsers, sessions } = await createAdminUsersFixture();

    await AdminUsers.login('admin', 'correct-password', '127.0.0.1', 'active-agent');
    sessions.push({
        session_id: 'expired-session',
        admin_id: 1,
        refresh_token_hash: 'expired',
        expires_at: new Date(Date.now() - 1000),
        revoked_at: null
    });
    sessions.push({
        session_id: 'old-revoked-session',
        admin_id: 1,
        refresh_token_hash: 'old-revoked',
        expires_at: new Date(Date.now() + 100000),
        revoked_at: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000)
    });

    const deletedCount = await AdminUsers.cleanupExpiredSessions(7);

    assert.equal(deletedCount, 2);
    assert.equal(sessions.some((session) => session.session_id === 'expired-session'), false);
    assert.equal(sessions.some((session) => session.session_id === 'old-revoked-session'), false);
    assert.equal(sessions.length, 1);
});

test('AdminUsers.cleanupExpiredSessions falls back for partially numeric retention days', async () => {
    const { AdminUsers, sessions } = await createAdminUsersFixture();

    await AdminUsers.login('admin', 'correct-password', '127.0.0.1', 'active-agent');
    sessions.push({
        session_id: 'recent-revoked-session',
        admin_id: 1,
        refresh_token_hash: 'recent-revoked',
        expires_at: new Date(Date.now() + 100000),
        revoked_at: new Date(Date.now() - 24 * 60 * 60 * 1000)
    });

    const deletedCount = await AdminUsers.cleanupExpiredSessions('0abc');

    assert.equal(deletedCount, 0);
    assert.equal(sessions.some((session) => session.session_id === 'recent-revoked-session'), true);
});

test('AdminUsers.update can explicitly clear nullable profile fields', async () => {
    const { AdminUsers, queryCalls } = await createAdminUsersFixture();

    await AdminUsers.update(1, {
        full_name: null,
        is_active: false
    });

    const updateCall = queryCalls.find((call) => call.sql.startsWith('update admin_users'));
    assert.ok(updateCall);
    assert.equal(updateCall.sql.includes('coalesce'), false);
    assert.equal(updateCall.sql.includes('full_name = ?'), true);
    assert.equal(updateCall.sql.includes('is_active = ?'), true);
    assert.equal(updateCall.sql.includes('username = ?'), false);
    assert.deepEqual(updateCall.params, [null, false, 1]);
});

test('AdminUsers.update hashes password and revokes active sessions', async () => {
    const { AdminUsers, queryCalls, sessions } = await createAdminUsersFixture();
    sessions.push({
        session_id: 'active-session',
        admin_id: 1,
        refresh_token_hash: 'active-token',
        expires_at: new Date(Date.now() + 100000),
        revoked_at: null
    });

    await AdminUsers.update(1, {
        password: 'NewStrongPass123'
    });

    const updateCall = queryCalls.find((call) => (
        call.sql.startsWith('update admin_users') && call.sql.includes('password_hash = ?')
    ));

    assert.ok(updateCall);
    assert.equal(updateCall.params.length, 2);
    assert.notEqual(updateCall.params[0], 'NewStrongPass123');
    assert.equal(await bcrypt.compare('NewStrongPass123', updateCall.params[0]), true);
    assert.equal(updateCall.params[1], 1);
    assert.equal(sessions[0].revoked_at instanceof Date, true);
});
