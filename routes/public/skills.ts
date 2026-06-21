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
 *     tags: ['Public']
 * /public/skills/featured:
 *   get:
 *     summary: 주요 기술 스택 조회
 *     tags: ['Public']
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
