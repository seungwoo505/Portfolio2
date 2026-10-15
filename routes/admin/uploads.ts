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
 *     tags:
 *       - Admin - Files
 *     security:
 *       - bearerAuth: []
 *     description: >-
 *       필요 권한: files.create. JPEG, PNG, GIF, WebP 이미지만 허용하며 MIME 타입과 확장자가 일치해야 합니다. 기본 최대 크기 5 MiB이며
 *       UPLOAD_MAX_FILE_SIZE로 변경할 수 있습니다.
 *     responses:
 *       '200':
 *         description: 성공
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                 data:
 *                   type: object
 *                   properties:
 *                     url:
 *                       type: string
 *                       format: uri
 *                     filename:
 *                       type: string
 *                     originalName:
 *                       type: string
 *                     size:
 *                       type: integer
 *                       description: 바이트 크기
 *       '400':
 *         description: 필수 값 누락 또는 유효하지 않은 입력
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       '401':
 *         description: 인증 토큰이 없거나 유효하지 않음
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       '403':
 *         description: 필요한 권한 또는 역할 없음
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       '413':
 *         description: 허용된 요청 또는 파일 크기 초과
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       '500':
 *         description: 서버 오류
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
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
 *             required:
 *               - image
 * /admin/upload/image/{filename}:
 *   delete:
 *     summary: 업로드 이미지 삭제
 *     tags:
 *       - Admin - Files
 *     security:
 *       - bearerAuth: []
 *     description: '필요 권한: files.delete. 업로드 응답에서 받은 filename을 사용합니다. 이전 형식과 난수 접미사가 포함된 현재 형식을 모두 허용합니다.'
 *     parameters:
 *       - in: path
 *         name: filename
 *         required: true
 *         description: 업로드 응답의 filename
 *         schema:
 *           type: string
 *     responses:
 *       '200':
 *         description: 성공
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *       '400':
 *         description: 필수 값 누락 또는 유효하지 않은 입력
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       '401':
 *         description: 인증 토큰이 없거나 유효하지 않음
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       '403':
 *         description: 필요한 권한 또는 역할 없음
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       '404':
 *         description: 대상을 찾을 수 없음
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       '500':
 *         description: 서버 오류
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
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
export {};
