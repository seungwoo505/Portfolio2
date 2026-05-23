const express = require('express');
const router = express.Router();
const { logger, verboseDebug, buildErrorLog } = require('./common');
const { authenticateToken, requirePermission, logActivity } = require('../../middleware/auth');


const multer = require('multer');
const path = require('path');
const fs = require('fs');

const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        const uploadPath = path.join(__dirname, '..', '..', 'uploads', 'images');

        if (!fs.existsSync(uploadPath)) {
            fs.mkdirSync(uploadPath, { recursive: true });
        }

        cb(null, uploadPath);
    },
    filename: function (req, file, cb) {
        const timestamp = Date.now();
        const ext = path.extname(file.originalname).toLowerCase();
        let baseName = path.basename(file.originalname, ext);

        baseName = baseName
            .replace(/[^a-zA-Z0-9가-힣]/g, '')
            .substring(0, 20);

        if (!baseName) {
            baseName = 'image';
        }

        const finalName = timestamp + '-' + baseName + ext;

        cb(null, finalName);
    }
});

const fileFilter = (req, file, cb) => {
    const allowedMimes = [
        'image/jpeg',
        'image/jpg',
        'image/png',
        'image/gif',
        'image/webp'
    ];

    if (allowedMimes.includes(file.mimetype)) {
        cb(null, true);
    } else {
        cb(new Error('지원되지 않는 이미지 형식입니다.'), false);
    }
};

const upload = multer({
    storage: storage,
    fileFilter: fileFilter,
    limits: {
        fileSize: 5 * 1024 * 1024
    }
});

/**
 * @swagger
 * /api/admin/upload/image:
 *   post:
 *     summary: 이미지 업로드
 *     tags: ['Admin - Files']
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               image:
 *                 type: string
 *                 format: binary
 *     responses:
 *       200:
 *         description: 업로드 성공
 *       400:
 *         description: 잘못된 요청
 *       500:
 *         description: 서버 오류
 * /api/admin/upload/image/{filename}:
 *   delete:
 *     summary: 업로드 이미지 삭제
 *     tags: ['Admin - Files']
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: filename
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: 삭제 성공
 *       404:
 *         description: 파일 없음
 *       500:
 *         description: 서버 오류
 */
router.post('/upload/image',
    authenticateToken,
    upload.single('image'),
    logActivity('upload_image'),
    async (req, res) => {
        try {
            if (!req.file) {
                return res.status(400).json({
                    success: false,
                    message: '업로드할 이미지 파일이 없습니다.'
                });
            }

            const fileInfo = {
                originalName: req.file.originalname,
                filename: req.file.filename,
                size: req.file.size,
                mimetype: req.file.mimetype,
                path: req.file.path
            };

            const baseUrl = req.protocol + '://' + req.get('host');
            const imageUrl = `${baseUrl}/uploads/images/${req.file.filename}`;

            verboseDebug('이미지 업로드 성공:', fileInfo);

            res.json({
                success: true,
                message: '이미지가 성공적으로 업로드되었습니다.',
                data: {
                    url: imageUrl,
                    filename: req.file.filename,
                    originalName: req.file.originalname,
                    size: req.file.size
                }
            });

        } catch (error) {
            logger.error('이미지 업로드 실패', buildErrorLog(error, req));
            res.status(500).json({
                success: false,
                message: error.message || '이미지 업로드에 실패했습니다.'
            });
        }
    }
);

router.delete('/upload/image/:filename',
    authenticateToken,
    requirePermission('files.delete'),
    logActivity('delete_image'),
    async (req, res) => {
        try {
            const filename = req.params.filename;
            const filePath = path.join(__dirname, '..', '..', 'uploads', 'images', filename);

            if (!fs.existsSync(filePath)) {
                return res.status(404).json({
                    success: false,
                    message: '삭제할 이미지를 찾을 수 없습니다.'
                });
            }

            fs.unlinkSync(filePath);

            res.json({
                success: true,
                message: '이미지가 성공적으로 삭제되었습니다.'
            });

        } catch (error) {
            logger.error('이미지 삭제 실패', buildErrorLog(error, req));
            res.status(500).json({
                success: false,
                message: '이미지 삭제에 실패했습니다.'
            });
        }
    }
);

module.exports = router;

