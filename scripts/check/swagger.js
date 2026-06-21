const fs = require('fs');
const path = require('path');

const { rootDir } = require('./context');

const sourceExtensions = new Set(['.js', '.ts']);

const resolveExistingSourcePath = (...candidates) => {
    const match = candidates.find((candidate) => fs.existsSync(candidate));
    if (!match) {
        throw new Error(`missing expected Swagger source file. Checked: ${candidates.join(', ')}`);
    }
    return match;
};

const checkSwaggerServerConfig = () => {
    const swaggerDir = path.join(rootDir, 'config', 'swagger');
    const swaggerFiles = [
        resolveExistingSourcePath(
            path.join(rootDir, 'config', 'swagger.js'),
            path.join(rootDir, 'config', 'swagger.ts')
        ),
        ...fs.readdirSync(swaggerDir)
            .filter((file) => sourceExtensions.has(path.extname(file)))
            .map((file) => path.join(swaggerDir, file))
    ];
    const swaggerContent = swaggerFiles.map((file) => fs.readFileSync(file, 'utf8')).join('\n');
    const failures = [];

    if (swaggerContent.includes('seungwoo.i234.me')) {
        failures.push('config/swagger source files must not hard-code deployment domains in Swagger configuration');
    }

    const swaggerOptionsPath = resolveExistingSourcePath(
        path.join(swaggerDir, 'options.js'),
        path.join(swaggerDir, 'options.ts')
    );
    const swaggerOptionsContent = fs.readFileSync(swaggerOptionsPath, 'utf8');
    const swaggerOptionsMatch = swaggerOptionsContent.match(/const\s+swaggerUiOptions(?:\s*:\s*[^=]+)?\s*=\s*\{[\s\S]*?\n\};/);
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

module.exports = {
    checkSwaggerServerConfig
};
