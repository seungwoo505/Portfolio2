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

    const { createSwaggerSpec } = require('../../config/swagger');
    const spec = createSwaggerSpec({ port: 3333 });
    const methods = ['get', 'post', 'put', 'patch', 'delete', 'head', 'options'];
    let operationCount = 0;
    for (const [routePath, pathItem] of Object.entries(spec.paths || {}) as Array<[string, Record<string, any>]>) {
        for (const method of methods) {
            const operation = pathItem[method];
            if (!operation) continue;
            operationCount++;
            if (Object.keys(operation.responses || {}).length === 0) {
                failures.push(`${method.toUpperCase()} ${routePath}: 응답 정의가 없습니다.`);
            }
            const parameters = [...(pathItem.parameters || []), ...(operation.parameters || [])];
            for (const [, name] of routePath.matchAll(/\{([^}]+)\}/g)) {
                if (!parameters.some(parameter => parameter.in === 'path' && parameter.name === name && parameter.required)) {
                    failures.push(`${method.toUpperCase()} ${routePath}: 필수 경로 변수 ${name} 정의가 없습니다.`);
                }
            }
        }
    }
    if (operationCount === 0) failures.push('Swagger 명세에 API 작업이 없습니다. 라우트 검색 경로를 확인하세요.');

    if (failures.length > 0) {
        throw new Error(`swagger server config check failed:\n${failures.join('\n')}`);
    }
};

module.exports = {
    checkSwaggerServerConfig
};
export {};
