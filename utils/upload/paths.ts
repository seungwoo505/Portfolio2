const fs = require('fs');
const path = require('path');

const uploadImageDir = path.join(__dirname, '..', '..', 'uploads', 'images');
const uploadedImageFilenamePattern = /^\d+-[a-zA-Z0-9가-힣]+\.(jpe?g|png|gif|webp)$/i;

const ensureUploadImageDir = (): void => {
    if (!fs.existsSync(uploadImageDir)) {
        fs.mkdirSync(uploadImageDir, { recursive: true });
    }
};

const sanitizeBaseName = (filename: string): string => {
    const ext = path.extname(filename).toLowerCase();
    const baseName = path
        .basename(filename, ext)
        .replace(/[^a-zA-Z0-9가-힣]/g, '')
        .substring(0, 20);

    return baseName || 'image';
};

const isSafeUploadedImageFilename = (filename: unknown): boolean => {
    if (typeof filename !== 'string' || !filename.trim()) {
        return false;
    }

    const basename = path.basename(filename);
    if (basename !== filename || !uploadedImageFilenamePattern.test(basename)) {
        return false;
    }

    const uploadRoot = path.resolve(uploadImageDir);
    const resolvedPath = path.resolve(uploadRoot, basename);
    return resolvedPath.startsWith(`${uploadRoot}${path.sep}`);
};

const getUploadedImagePath = (filename: string): string => path.resolve(uploadImageDir, path.basename(filename));

module.exports = {
    ensureUploadImageDir,
    getUploadedImagePath,
    isSafeUploadedImageFilename,
    sanitizeBaseName,
    uploadImageDir,
    uploadedImageFilenamePattern
};

export {};
