/**
 * @swagger
 * components:
 *   securitySchemes:
 *     bearerAuth:
 *       type: http
 *       scheme: bearer
 *       bearerFormat: JWT
 *   schemas:
 *     LoginRequest:
 *       type: object
 *       required:
 *         - username
 *         - password
 *       properties:
 *         username:
 *           type: string
 *           example: "admin"
 *         password:
 *           type: string
 *           example: "StrongAdminPass!2026"
 *     LoginResponse:
 *       type: object
 *       properties:
 *         success:
 *           type: boolean
 *           example: true
 *         token:
 *           type: string
 *           example: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
 *         refreshToken:
 *           type: string
 *           example: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
 *         user:
 *           type: object
 *           properties:
 *             id:
 *               type: integer
 *               example: 1
 *             username:
 *               type: string
 *               example: "admin"
 *             role:
 *               type: string
 *               example: "super_admin"
 *     ErrorResponse:
 *       type: object
 *       properties:
 *         success:
 *           type: boolean
 *           example: false
 *         message:
 *           type: string
 *           example: "에러 메시지"
 *     DashboardStats:
 *       type: object
 *       properties:
 *         blogPosts:
 *           type: object
 *           properties:
 *             total:
 *               type: integer
 *               example: 25
 *             published:
 *               type: integer
 *               example: 20
 *             drafts:
 *               type: integer
 *               example: 5
 *         projects:
 *           type: object
 *           properties:
 *             total:
 *               type: integer
 *               example: 12
 *             featured:
 *               type: integer
 *               example: 8
 *         contactMessages:
 *           type: integer
 *           example: 45
 *         adminActivity:
 *           type: integer
 *           example: 156
 */

module.exports = require('./admin/index');
