#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const rootDir = path.join(__dirname, '..');

const collectJsFiles = (directory) => {
    const absoluteDirectory = path.join(rootDir, directory);
    if (!fs.existsSync(absoluteDirectory)) {
        return [];
    }

    return fs
        .readdirSync(absoluteDirectory, { withFileTypes: true })
        .flatMap((entry) => {
            const relativePath = path.join(directory, entry.name);
            if (entry.isDirectory()) {
                return collectJsFiles(relativePath);
            }
            return entry.isFile() && entry.name.endsWith('.js') ? [relativePath] : [];
        });
};

const syntaxCheckFiles = Array.from(new Set([
    'server.js',
    'log.js',
    'db.js',
    ...collectJsFiles('routes'),
    ...collectJsFiles('models'),
    ...collectJsFiles('utils'),
    ...collectJsFiles('services'),
    ...collectJsFiles('middleware'),
    ...collectJsFiles('scripts'),
    ...collectJsFiles('migrations'),
    ...collectJsFiles(path.join('mcp', 'src')),
    ...collectJsFiles(path.join('mcp', 'scripts'))
])).sort();

const run = (args, label, options = {}) => {
    const stdio = options.stdio || 'inherit';
    const result = spawnSync(process.execPath, args, {
        cwd: rootDir,
        stdio,
        encoding: stdio === 'pipe' ? 'utf8' : undefined,
        env: {
            ...process.env,
            ...(options.env || {})
        },
        timeout: options.timeout
    });

    if (result.status !== 0) {
        if (stdio === 'pipe') {
            if (result.stdout) {
                process.stdout.write(result.stdout);
            }
            if (result.stderr) {
                process.stderr.write(result.stderr);
            }
        }
        if (result.error) {
            throw result.error;
        }
        throw new Error(`${label} failed`);
    }
};

const checkAdminRouteExport = () => {
    const adminRoutes = require(path.join(rootDir, 'routes', 'admin'));
    if (typeof adminRoutes !== 'function') {
        throw new Error('routes/admin must export an Express router function');
    }
};

const checkServerBoots = () => {
    const bootScript = `
        process.env.PORT = '0';
        process.env.NODE_ENV = 'development';
        process.env.LOCALHOST = 'http://localhost:3000';
        process.env.MY_HOST = 'http://localhost:3001';
        process.env.HTTPS_KEY = '';
        process.env.HTTPS_CERT = '';
        process.env.HTTPS_CA = '';
        process.env.REDIS_SOCKET = process.env.REDIS_SOCKET || '/tmp/portfolio-server-check.sock';
        require('./server');
        setTimeout(() => process.exit(0), 500);
    `;

    run(['-e', bootScript], 'server boot smoke', {
        stdio: 'pipe',
        timeout: 5000
    });
};

const checkRouteModelMethods = () => {
    const routeFiles = collectJsFiles('routes');
    const requirePattern = /const\s+([A-Z][A-Za-z0-9_]*)\s*=\s*require\(['"]\.\.\/\.\.\/models\/([^'"]+)['"]\)/g;
    const methodCallPattern = /\b([A-Z][A-Za-z0-9_]*)\.([A-Za-z_][A-Za-z0-9_]*)\s*\(/g;
    const failures = [];

    for (const routeFile of routeFiles) {
        const content = fs.readFileSync(path.join(rootDir, routeFile), 'utf8');
        const modelAliases = new Map();

        for (const match of content.matchAll(requirePattern)) {
            modelAliases.set(match[1], match[2]);
        }

        for (const match of content.matchAll(methodCallPattern)) {
            const [, alias, methodName] = match;
            if (!modelAliases.has(alias)) {
                continue;
            }

            const modelPath = path.join(rootDir, 'models', modelAliases.get(alias));
            const model = require(modelPath);
            if (typeof model[methodName] !== 'function') {
                failures.push(`${routeFile}: ${alias}.${methodName}() is not exported by models/${modelAliases.get(alias)}.js`);
            }
        }
    }

    if (failures.length > 0) {
        throw new Error(`route model method check failed:\n${failures.join('\n')}`);
    }
};

const checkRoutePermissionsSeeded = () => {
    const routeFiles = collectJsFiles('routes');
    const routePermissionPattern = /requirePermission\(['"]([^'"]+)['"]\)/g;
    const routePermissions = new Set();

    for (const routeFile of routeFiles) {
        const content = fs.readFileSync(path.join(rootDir, routeFile), 'utf8');
        for (const match of content.matchAll(routePermissionPattern)) {
            routePermissions.add(match[1]);
        }
    }

    const seedMigration = require(path.join(rootDir, 'migrations', '002_seed_admin.js'));
    const seedPermissions = new Set(seedMigration.permissions.map(([name]) => name));

    const manualSyncPath = path.join(rootDir, 'migrations', 'manual', 'sync-admin-permissions.sql');
    const manualSyncContent = fs.existsSync(manualSyncPath) ? fs.readFileSync(manualSyncPath, 'utf8') : '';
    const manualSyncPermissions = new Set(
        [...manualSyncContent.matchAll(/\(['"]([^'"]+)['"],\s*['"][^'"]+['"],\s*['"][^'"]+['"],/g)]
            .map((match) => match[1])
    );

    const extractSqlStringLiterals = (content) => (
        [...content.matchAll(/'([^']+)'/g)].map((match) => match[1])
    );

    const parseManualRolePermissions = (role) => {
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

    const addSetDifferenceFailures = (label, expectedPermissions, actualPermissions) => {
        const missing = [...expectedPermissions].filter((permission) => !actualPermissions.has(permission));
        const extra = [...actualPermissions].filter((permission) => !expectedPermissions.has(permission));

        if (missing.length > 0) {
            failures.push(`${label} missing: ${missing.join(', ')}`);
        }

        if (extra.length > 0) {
            failures.push(`${label} extra: ${extra.join(', ')}`);
        }
    };

    const missingFromSeed = [...routePermissions].filter((permission) => !seedPermissions.has(permission));
    const missingFromManualSync = [...routePermissions].filter((permission) => !manualSyncPermissions.has(permission));
    const missingFromManualDefinitions = [...seedPermissions].filter((permission) => !manualSyncPermissions.has(permission));
    const extraManualDefinitions = [...manualSyncPermissions].filter((permission) => !seedPermissions.has(permission));
    const failures = [];

    if (missingFromSeed.length > 0) {
        failures.push(`missing from migrations/002_seed_admin.js: ${missingFromSeed.join(', ')}`);
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

    for (const [role, expectedPermissions] of Object.entries(expectedRolePermissions)) {
        const actualPermissions = parseManualRolePermissions(role);
        if (!actualPermissions) {
            failures.push(`could not parse ${role} permissions from migrations/manual/sync-admin-permissions.sql`);
            continue;
        }

        addSetDifferenceFailures(
            `migrations/manual/sync-admin-permissions.sql ${role} role`,
            expectedPermissions,
            actualPermissions
        );
    }

    if (failures.length > 0) {
        throw new Error(`route permission seed check failed:\n${failures.join('\n')}`);
    }
};

const checkSwaggerServerConfig = () => {
    const serverContent = fs.readFileSync(path.join(rootDir, 'server.js'), 'utf8');
    const failures = [];

    if (serverContent.includes('seungwoo.i234.me')) {
        failures.push('server.js must not hard-code deployment domains in Swagger configuration');
    }

    const swaggerOptionsMatch = serverContent.match(/const\s+swaggerUiOptions\s*=\s*\{[\s\S]*?\n\};/);
    if (swaggerOptionsMatch) {
        const optionKeys = ['defaultModelsExpandDepth', 'defaultModelExpandDepth'];
        optionKeys.forEach((key) => {
            const count = (swaggerOptionsMatch[0].match(new RegExp(`${key}\\s*:`, 'g')) || []).length;
            if (count > 1) {
                failures.push(`swaggerUiOptions contains duplicate ${key}`);
            }
        });
    }

    if (failures.length > 0) {
        throw new Error(`swagger server config check failed:\n${failures.join('\n')}`);
    }
};

for (const file of syntaxCheckFiles) {
    run(['-c', file], `syntax check ${file}`);
}

checkAdminRouteExport();
checkRouteModelMethods();
checkRoutePermissionsSeeded();
checkSwaggerServerConfig();
checkServerBoots();

console.log(`server check passed (${syntaxCheckFiles.length} files)`);
