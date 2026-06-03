const fs = require('fs');
const path = require('path');

const { rootDir } = require('./context');

const checkSwaggerServerConfig = () => {
    const swaggerDir = path.join(rootDir, 'config', 'swagger');
    const swaggerFiles = [
        path.join(rootDir, 'config', 'swagger.js'),
        ...fs.readdirSync(swaggerDir)
            .filter((file) => file.endsWith('.js'))
            .map((file) => path.join(swaggerDir, file))
    ];
    const swaggerContent = swaggerFiles.map((file) => fs.readFileSync(file, 'utf8')).join('\n');
    const failures = [];

    if (swaggerContent.includes('seungwoo.i234.me')) {
        failures.push('config/swagger.js must not hard-code deployment domains in Swagger configuration');
    }

    const swaggerOptionsContent = fs.readFileSync(path.join(swaggerDir, 'options.js'), 'utf8');
    const swaggerOptionsMatch = swaggerOptionsContent.match(/const\s+swaggerUiOptions\s*=\s*\{[\s\S]*?\n\};/);
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
