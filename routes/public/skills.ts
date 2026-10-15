import type { Request, Response, Router } from 'express';

const express = require('express');
const Skills = require('../../models/skills');
const { cacheKey, cached, fail, ok } = require('./common');

const router: Router = express.Router();

/**
 * @swagger
 * /public/skills:
 *   get:
 *     summary: 공개 기술 스택 조회
 *     tags:
 *       - Skills
 *     security: []
 *     responses:
 *       '200':
 *         description: 조회 성공
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
 *                         skills:
 *                           type: array
 *                           items:
 *                             type: object
 *                             properties:
 *                               id:
 *                                 type: integer
 *                               category_id:
 *                                 type: integer
 *                                 nullable: true
 *                               name:
 *                                 type: string
 *                               category_name:
 *                                 type: string
 *                                 nullable: true
 *                               proficiency_level:
 *                                 type: integer
 *                                 nullable: true
 *                               years_of_experience:
 *                                 type: string
 *                                 nullable: true
 *                                 description: DB DECIMAL 값
 *                               icon:
 *                                 type: string
 *                                 nullable: true
 *                               color:
 *                                 type: string
 *                                 nullable: true
 *                               display_order:
 *                                 type: integer
 *                                 nullable: true
 *                               is_featured:
 *                                 type: integer
 *                                 enum:
 *                                   - 0
 *                                   - 1
 *                                   - null
 *                                 nullable: true
 *                                 description: DB의 boolean 값(0 또는 1)
 *                             additionalProperties: true
 *                         categories:
 *                           type: array
 *                           items:
 *                             type: object
 *                             properties:
 *                               id:
 *                                 type: integer
 *                               name:
 *                                 type: string
 *                               description:
 *                                 type: string
 *                                 nullable: true
 *                               display_order:
 *                                 type: integer
 *                                 nullable: true
 *                               skill_count:
 *                                 oneOf:
 *                                   - type: integer
 *                                     minimum: 0
 *                                   - type: string
 *                                     pattern: ^\d+$
 *                                 description: 기술 개수. COUNT 집계값은 DB 설정에 따라 문자열로 반환됩니다.
 *                                 example: '3'
 *                             additionalProperties: true
 *                         skillsByCategory:
 *                           type: array
 *                           items:
 *                             type: object
 *                             properties:
 *                               id:
 *                                 type: integer
 *                               name:
 *                                 type: string
 *                               description:
 *                                 type: string
 *                                 nullable: true
 *                               display_order:
 *                                 type: integer
 *                                 nullable: true
 *                               skill_count:
 *                                 oneOf:
 *                                   - type: integer
 *                                     minimum: 0
 *                                   - type: string
 *                                     pattern: ^\d+$
 *                                 description: 기술 개수. COUNT 집계값은 DB 설정에 따라 문자열로 반환됩니다.
 *                                 example: '3'
 *                               skills:
 *                                 type: array
 *                                 items:
 *                                   type: object
 *                                   properties:
 *                                     id:
 *                                       type: integer
 *                                     category_id:
 *                                       type: integer
 *                                       nullable: true
 *                                     name:
 *                                       type: string
 *                                     category_name:
 *                                       type: string
 *                                       nullable: true
 *                                     proficiency_level:
 *                                       type: integer
 *                                       nullable: true
 *                                     years_of_experience:
 *                                       type: string
 *                                       nullable: true
 *                                       description: DB DECIMAL 값
 *                                     icon:
 *                                       type: string
 *                                       nullable: true
 *                                     color:
 *                                       type: string
 *                                       nullable: true
 *                                     display_order:
 *                                       type: integer
 *                                       nullable: true
 *                                     is_featured:
 *                                       type: integer
 *                                       enum:
 *                                         - 0
 *                                         - 1
 *                                         - null
 *                                       nullable: true
 *                                       description: DB의 boolean 값(0 또는 1)
 *                                   additionalProperties: true
 *                             additionalProperties: true
 *                       required:
 *                         - skills
 *                         - categories
 *                         - skillsByCategory
 *                   required:
 *                     - success
 *                     - data
 *       '408':
 *         description: 요청 처리 시간 초과
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       '429':
 *         description: 요청 횟수 제한 초과
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       '500':
 *         description: 서버 처리 중 오류 발생
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 * /public/skills/featured:
 *   get:
 *     summary: 주요 기술 스택 조회
 *     tags:
 *       - Skills
 *     security: []
 *     description: 추천 기술만 카테고리와 기술의 노출 순서로 반환합니다.
 *     responses:
 *       '200':
 *         description: 조회 성공
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
 *                           category_id:
 *                             type: integer
 *                             nullable: true
 *                           name:
 *                             type: string
 *                           category_name:
 *                             type: string
 *                             nullable: true
 *                           proficiency_level:
 *                             type: integer
 *                             nullable: true
 *                           years_of_experience:
 *                             type: string
 *                             nullable: true
 *                             description: DB DECIMAL 값
 *                           icon:
 *                             type: string
 *                             nullable: true
 *                           color:
 *                             type: string
 *                             nullable: true
 *                           display_order:
 *                             type: integer
 *                             nullable: true
 *                           is_featured:
 *                             type: integer
 *                             enum:
 *                               - 0
 *                               - 1
 *                               - null
 *                             nullable: true
 *                             description: DB의 boolean 값(0 또는 1)
 *                         additionalProperties: true
 *                   required:
 *                     - success
 *                     - data
 *       '408':
 *         description: 요청 처리 시간 초과
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       '429':
 *         description: 요청 횟수 제한 초과
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       '500':
 *         description: 서버 처리 중 오류 발생
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.get('/skills', async (req: Request, res: Response) => {
    try {
        const data = await cached(cacheKey('skills', 'all'), async () => {
            const [skills, categories] = await Promise.all([
                Skills.getAllWithCategories(),
                Skills.getCategories()
            ]);

            const skillsByCategory = categories.map((category) => ({
                ...category,
                skills: skills.filter((skill) => skill.category_id === category.id)
            }));

            return {
                skills,
                categories,
                skillsByCategory
            };
        });

        return ok(res, data);
    } catch (error) {
        return fail(res, error, req, '스킬 정보를 가져오는데 실패했습니다.');
    }
});

router.get('/skills/featured', async (req: Request, res: Response) => {
    try {
        const data = await cached(cacheKey('skills', 'featured'), () => Skills.getFeatured());
        return ok(res, data);
    } catch (error) {
        return fail(res, error, req, '주요 스킬 정보를 가져오는데 실패했습니다.');
    }
});

module.exports = router;
