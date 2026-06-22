const fs = require('fs/promises');
const {
    getUploadedImagePath,
    isSafeUploadedImageFilename
} = require('../../../utils/upload');

const buildUploadedImageLog = (file) => ({
    originalName: file.originalname,
    filename: file.filename,
    size: file.size,
    mimetype: file.mimetype,
    path: file.path
});

const buildUploadedImageData = (req) => {
    const baseUrl = req.protocol + '://' + req.get('host');
    const imageUrl = `${baseUrl}/uploads/images/${req.file.filename}`;

    return {
        url: imageUrl,
        filename: req.file.filename,
        originalName: req.file.originalname,
        size: req.file.size
    };
};

const deleteUploadedImage = async (filename) => {
    if (!isSafeUploadedImageFilename(filename)) {
        return {
            deleted: false,
            status: 400,
            message: '올바르지 않은 이미지 파일명입니다.'
        };
    }

    const filePath = getUploadedImagePath(filename);
    try {
        await fs.unlink(filePath);
    } catch (error) {
        if (error.code !== 'ENOENT') {
            throw error;
        }
        return {
            deleted: false,
            status: 404,
            message: '삭제할 이미지를 찾을 수 없습니다.'
        };
    }

    return {
        deleted: true,
        status: 200,
        message: '이미지가 성공적으로 삭제되었습니다.'
    };
};

module.exports = {
    buildUploadedImageData,
    buildUploadedImageLog,
    deleteUploadedImage
};
export {};
