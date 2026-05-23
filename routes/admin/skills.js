const express = require('express');
const router = express.Router();
const { logger, buildErrorLog } = require('./common');
const Skills = require('../../models/skills');
const { authenticateToken, requirePermission, logActivity } = require('../../middleware/auth');

/**
 * @swagger
 * /api/admin/skills/categories:
 *   post:
 *     summary: 스킬 카테고리 생성
 *     tags: ['Admin - Skills']
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - name
 *             properties:
 *               name:
 *                 type: string
 *     responses:
 *       201:
 *         description: 카테고리 생성 성공
 *       400:
 *         description: 잘못된 요청
 *       500:
 *         description: 서버 오류
 *   get:
 *     summary: 스킬 카테고리 목록 조회
 *     tags: ['Admin - Skills']
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: 조회 성공
 *       500:
 *         description: 서버 오류
 * /api/admin/skills/categories/{id}:
 *   delete:
 *     summary: 스킬 카테고리 삭제
 *     tags: ['Admin - Skills']
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: 삭제 성공
 *       400:
 *         description: 잘못된 요청
 *       500:
 *         description: 서버 오류
 */
router.post('/skills/categories',
    authenticateToken,
    requirePermission('skills.create'),
    logActivity('create_skill_category'),
    async (req, res) => {
        try {
            const { name } = req.body;

            if (!name || !name.trim()) {
                return res.status(400).json({
                    success: false,
                    message: '카테고리명을 입력해주세요.'
                });
            }
            const existingCategory = await Skills.getCategoryByName(name.trim());
            
            if (existingCategory) {
                return res.status(400).json({
                    success: false,
                    message: '이미 존재하는 카테고리명입니다.'
                });
            }

            const categoryId = await Skills.createCategory(name.trim());

            res.status(201).json({
                success: true,
                message: '카테고리가 성공적으로 추가되었습니다.',
                data: { id: categoryId, name: name.trim() }
            });

        } catch (error) {
            logger.error('카테고리 추가 실패', buildErrorLog(error, req));
            res.status(500).json({
                success: false,
                message: '카테고리 추가에 실패했습니다.'
            });
        }
    }
);

router.delete('/skills/categories/:id',
    authenticateToken,
    requirePermission('skills.delete'),
    logActivity('delete_skill_category'),
    async (req, res) => {
        try {
            const categoryId = req.params.id;

            if (!categoryId) {
                return res.status(400).json({
                    success: false,
                    message: '카테고리 ID가 필요합니다.'
                });
            }
            
            const skillsUsingCategory = await Skills.getSkillsByCategory(categoryId);
            
            if (skillsUsingCategory && skillsUsingCategory.length > 0) {
                return res.status(400).json({
                    success: false,
                    message: '이 카테고리를 사용하는 기술 스택이 있어서 삭제할 수 없습니다.',
                    data: {
                        category_id: categoryId,
                        skills_count: skillsUsingCategory.length,
                        skills: skillsUsingCategory.map(skill => ({ id: skill.id, name: skill.name }))
                    }
                });
            }

            await Skills.deleteCategory(categoryId);

            res.json({
                success: true,
                message: '카테고리가 성공적으로 삭제되었습니다.'
            });

        } catch (error) {
            logger.error('카테고리 삭제 실패', buildErrorLog(error, req));
            res.status(500).json({
                success: false,
                message: '카테고리 삭제에 실패했습니다.'
            });
        }
    }
);

router.get('/skills/categories',
    authenticateToken,
    requirePermission('skills.read'),
    async (req, res) => {
        try {
            const categories = await Skills.getCategories();

            res.json({
                success: true,
                data: categories
            });

        } catch (error) {
            logger.error('카테고리 목록 조회 실패', buildErrorLog(error, req));
            res.status(500).json({
                success: false,
                message: '카테고리 목록을 가져오는데 실패했습니다.'
            });
        }
    }
);

/**
 * @swagger
 * /api/admin/skills:
 *   get:
 *     summary: 기술 스택 목록 조회 (관리자)
 *     tags: ['Admin - Skills']
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: 기술 목록 조회 성공
 *   post:
 *     summary: 기술 스택 생성
 *     tags: ['Admin - Skills']
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - name
 *               - category_id
 *             properties:
 *               name:
 *                 type: string
 *               category_id:
 *                 type: integer
 *               proficiency_level:
 *                 type: integer
 *               display_order:
 *                 type: integer
 *               is_featured:
 *                 type: boolean
 *     responses:
 *       201:
 *         description: 기술 생성 성공
 *       400:
 *         description: 잘못된 요청
 *       500:
 *         description: 서버 오류
 */
router.get('/skills',
    authenticateToken,
    requirePermission('skills.read'),
    async (req, res) => {
        try {
            const skills = await Skills.getAll();

            res.json({
                success: true,
                data: skills
            });

        } catch (error) {
            logger.error('기술 스택 목록 조회 실패', buildErrorLog(error, req));
            res.status(500).json({
                success: false,
                message: '기술 스택 목록을 가져오는데 실패했습니다.'
            });
        }
    }
);

router.post('/skills',
    authenticateToken,
    requirePermission('skills.create'),
    logActivity('create_skill'),
    async (req, res) => {
        try {
            const { name, category_id, proficiency_level, display_order, is_featured } = req.body;

            if (!name || !category_id) {
                return res.status(400).json({
                    success: false,
                    message: '기술명과 카테고리는 필수입니다.'
                });
            }
            
            if (is_featured && display_order) {
                const existingSkill = await Skills.getByDisplayOrder(display_order);
                if (existingSkill) {
                    return res.status(400).json({
                        success: false,
                        message: `표시 순서 ${display_order}은(는) 이미 사용 중입니다. 다른 순서를 선택해주세요.`
                    });
                }
            }
            
            const cleanData = {
                name: name || '',
                category_id: category_id || '',
                proficiency_level: proficiency_level || 50,
                display_order: display_order || 0,
                is_featured: is_featured || false
            };
            
            const skillId = await Skills.createSkill(cleanData);

            const newSkill = await Skills.getSkillById(skillId);

            res.status(201).json({
                success: true,
                message: '기술 스택이 성공적으로 추가되었습니다.',
                data: newSkill
            });

        } catch (error) {
            logger.error('기술 스택 생성 실패', buildErrorLog(error, req));
            res.status(500).json({
                success: false,
                message: '기술 스택 생성에 실패했습니다.'
            });
        }
    }
);

/**
 * @swagger
 * /api/admin/skills/{id}:
 *   put:
 *     summary: 기술 스택 수정
 *     tags: ['Admin - Skills']
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             additionalProperties: true
 *     responses:
 *       200:
 *         description: 기술 수정 성공
 *       400:
 *         description: 잘못된 요청
 *       500:
 *         description: 서버 오류
 *   delete:
 *     summary: 기술 스택 삭제
 *     tags: ['Admin - Skills']
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: 기술 삭제 성공
 *       400:
 *         description: 잘못된 요청
 *       500:
 *         description: 서버 오류
 */
router.put('/skills/:id',
    authenticateToken,
    requirePermission('skills.update'),
    logActivity('update_skill'),
    async (req, res) => {
        try {
            const skillId = req.params.id;
            const { name, category_id, proficiency_level, display_order, is_featured } = req.body;
            

            if (!name || !category_id) {
                return res.status(400).json({
                    success: false,
                    message: '기술명과 카테고리는 필수입니다.'
                });
            }
            
            if (is_featured && display_order) {
                const existingSkill = await Skills.getByDisplayOrder(display_order, skillId);
                if (existingSkill) {
                    return res.status(400).json({
                        success: false,
                        message: `표시 순서 ${display_order}은(는) 이미 사용 중입니다. 다른 순서를 선택해주세요.`
                    });
                }
            }
            
            const cleanData = {
                name: name || '',
                category_id: category_id || '',
                proficiency_level: proficiency_level || 50,
                display_order: display_order || 0,
                is_featured: is_featured || false
            };
            
            await Skills.updateSkill(skillId, cleanData);

            const updatedSkill = await Skills.getSkillById(skillId);

            res.json({
                success: true,
                message: '기술 스택이 성공적으로 수정되었습니다.',
                data: updatedSkill
            });

        } catch (error) {
            logger.error('기술 스택 수정 실패', buildErrorLog(error, req));
            res.status(500).json({
                success: false,
                message: '기술 스택 수정에 실패했습니다.'
            });
        }
    }
);

router.delete('/skills/:id',
    authenticateToken,
    requirePermission('skills.delete'),
    logActivity('delete_skill'),
    async (req, res) => {
        try {
            const skillId = req.params.id;

            if (!skillId) {
                return res.status(400).json({
                    success: false,
                    message: '기술 스택 ID가 필요합니다.'
                });
            }
            await Skills.deleteSkill(skillId);

            res.json({
                success: true,
                message: '기술 스택이 성공적으로 삭제되었습니다.'
            });

        } catch (error) {
            logger.error('기술 스택 삭제 실패', buildErrorLog(error, req));
            res.status(500).json({
                success: false,
                message: '기술 스택 삭제에 실패했습니다.'
            });
        }
    }
);

/**
 * @swagger
 * /api/admin/skills/{id}/featured:
 *   patch:
 *     summary: 기술 추천 상태 변경
 *     tags: ['Admin - Skills']
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               is_featured:
 *                 type: boolean
 *     responses:
 *       200:
 *         description: 상태 변경 성공
 *       400:
 *         description: 잘못된 요청
 *       500:
 *         description: 서버 오류
 * /api/admin/skills/{id}/order:
 *   patch:
 *     summary: 기술 표시 순서 변경
 *     tags: ['Admin - Skills']
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               display_order:
 *                 type: integer
 *     responses:
 *       200:
 *         description: 순서 변경 성공
 *       400:
 *         description: 잘못된 요청
 *       500:
 *         description: 서버 오류
 */
router.patch('/skills/:id/featured',
    authenticateToken,
    requirePermission('skills.update'),
    logActivity('toggle_skill_featured'),
    async (req, res) => {
        try {
            const skillId = req.params.id;
            const { is_featured } = req.body;

            if (typeof is_featured !== 'boolean') {
                return res.status(400).json({
                    success: false,
                    message: '추천 상태는 boolean 값이어야 합니다.'
                });
            }
            await Skills.updateSkill(skillId, { is_featured });

            res.json({
                success: true,
                message: `기술 스택이 ${is_featured ? '추천' : '일반'} 상태로 변경되었습니다.`
            });

        } catch (error) {
            logger.error('기술 스택 추천 상태 변경 실패', buildErrorLog(error, req));
            res.status(500).json({
                success: false,
                message: '기술 스택 추천 상태 변경에 실패했습니다.'
            });
        }
    }
);

router.patch('/skills/:id/order',
    authenticateToken,
    requirePermission('skills.update'),
    logActivity('update_skill_order'),
    async (req, res) => {
        try {
            const skillId = req.params.id;
            const { display_order } = req.body;

            if (typeof display_order !== 'number' || display_order < 0) {
                return res.status(400).json({
                    success: false,
                    message: '표시 순서는 0 이상의 숫자여야 합니다.'
                });
            }
            await Skills.updateSkill(skillId, { display_order });

            res.json({
                success: true,
                message: '기술 스택 순서가 성공적으로 변경되었습니다.'
            });

        } catch (error) {
            logger.error('기술 스택 순서 변경 실패', buildErrorLog(error, req));
            res.status(500).json({
                success: false,
                message: '기술 스택 순서 변경에 실패했습니다.'
            });
        }
    }
);

module.exports = router;

