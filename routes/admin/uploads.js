const express = require('express');
const router = express.Router();
const { logger, verboseDebug, buildErrorLog } = require('./common');
const { authenticateToken, requirePermission, logActivity } = require('../../middleware/auth');
const { uploadImage } = require('../../utils/upload');
const {
    buildUploadedImageData,
    buildUploadedImageLog,
    deleteUploadedImage
} = require('./uploads/images');

/**
 * @swagger
 * /admin/upload/image:
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
 * /admin/upload/image/{filename}:
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
    requirePermission('files.create'),
    uploadImage,
    logActivity('upload_image'),
    async (req, res) => {
        try {
            if (!req.file) {
                return res.status(400).json({
                    success: false,
                    message: '업로드할 이미지 파일이 없습니다.'
                });
            }

            verboseDebug('이미지 업로드 성공:', buildUploadedImageLog(req.file));

            res.json({
                success: true,
                message: '이미지가 성공적으로 업로드되었습니다.',
                data: buildUploadedImageData(req)
            });

        } catch (error) {
            logger.error('이미지 업로드 실패', buildErrorLog(error, req));
            res.status(500).json({
                success: false,
                message: '이미지 업로드에 실패했습니다.'
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
            const result = await deleteUploadedImage(req.params.filename);
            if (!result.deleted) {
                return res.status(result.status).json({
                    success: false,
                    message: result.message
                });
            }

            res.json({
                success: true,
                message: result.message
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
