const express = require('express');
const Tags = require('../../../models/tags');
const CacheUtils = require('../../../utils/cache');
const { toOptionalBoolean, toStringValue } = require('../../../utils/filter-values');
const { authenticateToken, requirePermission, logActivity } = require('../../../middleware/auth');
const {
    getTagPayload,
    validateCreateTagPayload
} = require('./payload');

const router = express.Router();

/**
 * @swagger
 * /admin/tags:
 *   get:
 *     summary: 태그 목록 조회 (관리자)
 *     tags:
 *       - Admin - Tags
 *     security:
 *       - bearerAuth: []
 *     description: tags.read 권한이 필요합니다. popular=true이면 사용 횟수가 1 이상인 인기 태그를 최대 50개 반환합니다.
 *     parameters:
 *       - name: type
 *         in: query
 *         description: 태그 유형으로 필터링합니다. 빈 문자열 또는 생략 시 전체 유형입니다.
 *         schema:
 *           type: string
 *       - name: popular
 *         in: query
 *         description: true일 때만 인기 태그로 제한합니다.
 *         schema:
 *           type: boolean
 *     responses:
 *       '200':
 *         description: 태그 목록
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/Success'
 *                 - type: object
 *                   properties:
 *                     data:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           id:
 *                             type: integer
 *                             description: 태그 ID
 *                           name:
 *                             type: string
 *                             description: 태그 이름
 *                           slug:
 *                             type: string
 *                             description: 태그 주소
 *                           description:
 *                             type: string
 *                             description: 태그 설명
 *                             nullable: true
 *                           color:
 *                             type: string
 *                             description: 색상
 *                             nullable: true
 *                           type:
 *                             type: string
 *                             description: 태그 유형
 *                             nullable: true
 *                           usage_count:
 *                             type: integer
 *                             description: 사용 횟수
 *                             nullable: true
 *                           created_at:
 *                             type: string
 *                             description: DB 날짜와 시간 문자열(YYYY-MM-DD HH:mm:ss)
 *                             nullable: true
 *                           updated_at:
 *                             type: string
 *                             description: DB 날짜와 시간 문자열(YYYY-MM-DD HH:mm:ss)
 *                             nullable: true
 *                   required:
 *                     - success
 *                     - data
 *       '400':
 *         description: popular가 boolean 값이 아님
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
 *         description: 해당 작업 권한이 없음
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       '500':
 *         description: 서버 또는 권한 확인 오류
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *   post:
 *     summary: 태그 생성
 *     tags:
 *       - Admin - Tags
 *     security:
 *       - bearerAuth: []
 *     description: tags.create 권한이 필요합니다.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *                 description: 태그 이름
 *                 minLength: 1
 *                 pattern: \S
 *                 maxLength: 100
 *                 example: TypeScript
 *               slug:
 *                 type: string
 *                 description: 생략하면 이름으로 고유한 주소를 생성합니다.
 *                 nullable: true
 *                 maxLength: 120
 *               description:
 *                 type: string
 *                 description: 태그 설명
 *                 nullable: true
 *               color:
 *                 type: string
 *                 description: 색상
 *                 nullable: true
 *                 maxLength: 20
 *                 default: null
 *               type:
 *                 type: string
 *                 description: 태그 유형. 임의 문자열이며 enum 제한은 없습니다.
 *                 nullable: true
 *                 maxLength: 50
 *                 default: general
 *             required:
 *               - name
 *     responses:
 *       '201':
 *         description: 생성된 태그
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/Success'
 *                 - type: object
 *                   properties:
 *                     data:
 *                       type: object
 *                       properties:
 *                         id:
 *                           type: integer
 *                           description: 태그 ID
 *                         name:
 *                           type: string
 *                           description: 태그 이름
 *                         slug:
 *                           type: string
 *                           description: 태그 주소
 *                         description:
 *                           type: string
 *                           description: 태그 설명
 *                           nullable: true
 *                         color:
 *                           type: string
 *                           description: 색상
 *                           nullable: true
 *                         type:
 *                           type: string
 *                           description: 태그 유형
 *                           nullable: true
 *                         usage_count:
 *                           type: integer
 *                           description: 사용 횟수
 *                           nullable: true
 *                         created_at:
 *                           type: string
 *                           description: DB 날짜와 시간 문자열(YYYY-MM-DD HH:mm:ss)
 *                           nullable: true
 *                         updated_at:
 *                           type: string
 *                           description: DB 날짜와 시간 문자열(YYYY-MM-DD HH:mm:ss)
 *                           nullable: true
 *                     message:
 *                       type: string
 *                       description: 처리 결과 메시지
 *                   required:
 *                     - success
 *                     - data
 *                     - message
 *       '400':
 *         description: 태그 이름이 없거나 공백뿐임
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
 *         description: 해당 작업 권한이 없음
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       '500':
 *         description: 서버 또는 권한 확인 오류
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.get('/tags', authenticateToken, requirePermission('tags.read'), async (req, res) => {
    try {
        const type = toStringValue(req.query.type).trim() || null;
        const popular = toOptionalBoolean(req.query.popular);
        if (!popular.isValid) {
            return res.status(400).json({ success: false, message: 'popular 값은 boolean이어야 합니다.' });
        }

        const tags = popular.value === true
            ? await Tags.getPopular(50, { type })
            : await Tags.getAll({ type });

        res.json({ success: true, data: tags });
    } catch (error) {
        res.status(500).json({ success: false, message: '태그 목록을 가져오는데 실패했습니다.' });
    }
});

router.post('/tags', authenticateToken, requirePermission('tags.create'), logActivity('create_tag'), async (req, res) => {
    try {
        const body = getTagPayload(req);
        const validationError = validateCreateTagPayload(body);
        if (validationError) {
            return res.status(400).json({ success: false, message: validationError });
        }

        const { name, slug, description, color, type } = body;
        const id = await Tags.create({ name, slug, description, color, type });
        const created = await Tags.getById(id);
        CacheUtils.invalidateResources('tags', 'projects', 'blog');
        res.status(201).json({ success: true, message: '태그가 생성되었습니다.', data: created });
    } catch (error) {
        res.status(500).json({ success: false, message: '태그 생성에 실패했습니다.' });
    }
});

module.exports = router;
export {};
