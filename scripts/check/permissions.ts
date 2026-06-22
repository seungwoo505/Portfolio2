const fs = require('fs');
const path = require('path');

const { collectSourceFiles, rootDir } = require('./context');

const extractSqlStringLiterals = (content) => (
    [...content.matchAll(/'([^']+)'/g)].map((match) => match[1])
);

const buildManualRoleParser = ({ manualSyncContent, manualSyncPermissions }) => (role) => {
    if (role === 'super_admin') {
        return new Set(manualSyncPermissions);
    }

    const rolePattern = new RegExp(
        `SELECT\\s+'${role}',\\s+id\\s+FROM\\s+admin_permissions\\s+WHERE\\s+([\\s\\S]*?);`,
        'i'
    );
    const match = manualSyncContent.match(rolePattern);
    if (!match) {
        return null;
    }

    const whereClause = match[1];
    const inMatch = whereClause.match(/name\s+IN\s*\(([\s\S]*?)\)/i);
    if (inMatch) {
        return new Set(extractSqlStringLiterals(inMatch[1]));
    }

    const notInMatch = whereClause.match(/name\s+NOT\s+IN\s*\(([\s\S]*?)\)/i);
    if (notInMatch) {
        const excludedPermissions = new Set(extractSqlStringLiterals(notInMatch[1]));
        return new Set(
            [...manualSyncPermissions].filter((permission) => !excludedPermissions.has(permission))
        );
    }

    return null;
};

const addSetDifferenceFailures = ({ failures, label, expectedPermissions, actualPermissions }) => {
    const missing = [...expectedPermissions].filter((permission) => !actualPermissions.has(permission));
    const extra = [...actualPermissions].filter((permission) => !expectedPermissions.has(permission));

    if (missing.length > 0) {
        failures.push(`${label} missing: ${missing.join(', ')}`);
    }

    if (extra.length > 0) {
        failures.push(`${label} extra: ${extra.join(', ')}`);
    }
};

const collectRoutePermissions = () => {
    const routeFiles = collectSourceFiles('routes');
    const routePermissionPattern = /requirePermission\(['"]([^'"]+)['"]\)/g;
    const routePermissions = new Set();

    for (const routeFile of routeFiles) {
        const content = fs.readFileSync(path.join(rootDir, routeFile), 'utf8');
        for (const match of content.matchAll(routePermissionPattern)) {
            routePermissions.add(match[1]);
        }
    }

    return routePermissions;
};

const checkRoutePermissionsSeeded = () => {
    const routePermissions = collectRoutePermissions();
    const seedMigration = require(path.join(rootDir, 'migrations', '002_seed_admin.ts'));
    const seedPermissions = new Set(seedMigration.permissions.map(([name]) => name));

    const manualSyncPath = path.join(rootDir, 'migrations', 'manual', 'sync-admin-permissions.sql');
    const manualSyncContent = fs.existsSync(manualSyncPath) ? fs.readFileSync(manualSyncPath, 'utf8') : '';
    const manualSyncPermissions = new Set(
        [...manualSyncContent.matchAll(/\(['"]([^'"]+)['"],\s*['"][^'"]+['"],\s*['"][^'"]+['"],/g)]
            .map((match) => match[1])
    );

    const missingFromSeed = [...routePermissions].filter((permission) => !seedPermissions.has(permission));
    const missingFromManualSync = [...routePermissions].filter((permission) => !manualSyncPermissions.has(permission));
    const missingFromManualDefinitions = [...seedPermissions].filter((permission) => !manualSyncPermissions.has(permission));
    const extraManualDefinitions = [...manualSyncPermissions].filter((permission) => !seedPermissions.has(permission));
    const failures = [];

    if (missingFromSeed.length > 0) {
        failures.push(`missing from migrations/002_seed_admin.ts: ${missingFromSeed.join(', ')}`);
    }

    if (missingFromManualSync.length > 0) {
        failures.push(`missing from migrations/manual/sync-admin-permissions.sql: ${missingFromManualSync.join(', ')}`);
    }

    if (missingFromManualDefinitions.length > 0) {
        failures.push(`missing permission definitions from migrations/manual/sync-admin-permissions.sql: ${missingFromManualDefinitions.join(', ')}`);
    }

    if (extraManualDefinitions.length > 0) {
        failures.push(`extra permission definitions in migrations/manual/sync-admin-permissions.sql: ${extraManualDefinitions.join(', ')}`);
    }

    const expectedRolePermissions = {
        super_admin: seedPermissions,
        admin: new Set(seedMigration.rolePermissions.admin),
        editor: new Set(seedMigration.rolePermissions.editor)
    };
    const parseManualRolePermissions = buildManualRoleParser({
        manualSyncContent,
        manualSyncPermissions
    });

    for (const [role, expectedPermissions] of Object.entries(expectedRolePermissions)) {
        const actualPermissions = parseManualRolePermissions(role);
        if (!actualPermissions) {
            failures.push(`could not parse ${role} permissions from migrations/manual/sync-admin-permissions.sql`);
            continue;
        }

        addSetDifferenceFailures({
            failures,
            label: `migrations/manual/sync-admin-permissions.sql ${role} role`,
            expectedPermissions,
            actualPermissions
        });
    }

    if (failures.length > 0) {
        throw new Error(`route permission seed check failed:\n${failures.join('\n')}`);
    }
};

module.exports = {
    checkRoutePermissionsSeeded
};
export {};
