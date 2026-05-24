const express = require('express');
const router = express.Router();
const { logger, buildErrorLog } = require('./common');
const Skills = require('../../models/skills');
const CacheUtils = require('../../utils/cache');
const { toBooleanOrNull, toStringValue } = require('../../utils/filter-values');
const { authenticateToken, requirePermission, logActivity } = require('../../middleware/auth');

const hasOwn = (value, key) => Object.prototype.hasOwnProperty.call(value, key);

const parseNumber = (value, { integer = false, min = 0, max = null } = {}) => {
    if (value === null || value === '') {
        return null;
    }

    const parsed = integer ? Number.parseInt(value, 10) : Number(value);
    if (!Number.isFinite(parsed) || parsed < min || (max !== null && parsed > max)) {
        return undefined;
    }

    return parsed;
};

const setStringField = (payload, body, field, { nullable = true } = {}) => {
    if (!hasOwn(body, field)) {
        return null;
    }

    const value = body[field] === null ? null : toStringValue(body[field]).trim();
    if (value === '' && nullable) {
        payload[field] = null;
        return null;
    }
    if (value === '') {
        return `${field} 값이 필요합니다.`;
    }

    payload[field] = value;
    return null;
};

const normalizeSkillPayload = (body = {}, { requireRequired = false } = {}) => {
    const payload = {};

    if (requireRequired && !hasOwn(body, 'name')) {
        return { error: '기술명을 입력해주세요.' };
    }
    if (requireRequired || hasOwn(body, 'name')) {
        const nameError = setStringField(payload, body, 'name', { nullable: false });
        if (nameError) {
            return { error: '기술명을 입력해주세요.' };
        }
    }

    if (requireRequired || hasOwn(body, 'category_id')) {
        const categoryId = parseNumber(body.category_id, { integer: true, min: 1 });
        if (categoryId === undefined || categoryId === null) {
            return { error: '유효한 카테고리를 선택해주세요.' };
        }
        payload.category_id = categoryId;
    }

    if (hasOwn(body, 'proficiency_level')) {
        const proficiencyLevel = parseNumber(body.proficiency_level, { integer: true, min: 0, max: 100 });
        if (proficiencyLevel === undefined || proficiencyLevel === null) {
            return { error: '숙련도는 0부터 100 사이의 숫자여야 합니다.' };
        }
        payload.proficiency_level = proficiencyLevel;
    } else if (requireRequired) {
        payload.proficiency_level = 50;
    }

    if (hasOwn(body, 'years_of_experience')) {
        const yearsOfExperience = parseNumber(body.years_of_experience, { min: 0 });
        if (yearsOfExperience === undefined) {
            return { error: '경력 연수는 0 이상의 숫자여야 합니다.' };
        }
        payload.years_of_experience = yearsOfExperience;
    } else if (requireRequired) {
        payload.years_of_experience = null;
    }

    for (const field of ['icon', 'color']) {
        const error = setStringField(payload, body, field);
        if (error) {
            return { error };
        }
        if (requireRequired && !hasOwn(payload, field)) {
            payload[field] = null;
        }
    }

    if (hasOwn(body, 'display_order')) {
        const displayOrder = parseNumber(body.display_order, { integer: true, min: 0 });
        if (displayOrder === undefined || displayOrder === null) {
            return { error: '표시 순서는 0 이상의 숫자여야 합니다.' };
        }
        payload.display_order = displayOrder;
    } else if (requireRequired) {
        payload.display_order = 0;
    }

    if (hasOwn(body, 'is_featured')) {
        const isFeatured = toBooleanOrNull(body.is_featured);
        if (isFeatured === null) {
            return { error: '추천 상태는 boolean 값이어야 합니다.' };
        }
        payload.is_featured = isFeatured;
    } else if (requireRequired) {
        payload.is_featured = false;
    }

    return { data: payload };
};

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
            CacheUtils.invalidateResources('skills');

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
            CacheUtils.invalidateResources('skills');

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
 *               years_of_experience:
 *                 type: number
 *               icon:
 *                 type: string
 *               color:
 *                 type: string
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
            const { data: cleanData, error } = normalizeSkillPayload(req.body, {
                requireRequired: true
            });
            if (error) {
                return res.status(400).json({
                    success: false,
                    message: error
                });
            }
            
            if (cleanData.is_featured && cleanData.display_order) {
                const existingSkill = await Skills.getByDisplayOrder(cleanData.display_order);
                if (existingSkill) {
                    return res.status(400).json({
                        success: false,
                        message: `표시 순서 ${cleanData.display_order}은(는) 이미 사용 중입니다. 다른 순서를 선택해주세요.`
                    });
                }
            }
            
            const skillId = await Skills.createSkill(cleanData);

            const newSkill = await Skills.getSkillById(skillId);
            CacheUtils.invalidateResources('skills');

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
            const existingSkill = await Skills.getSkillById(skillId);
            if (!existingSkill) {
                return res.status(404).json({
                    success: false,
                    message: '기술 스택을 찾을 수 없습니다.'
                });
            }

            const { data: cleanData, error } = normalizeSkillPayload(req.body);
            if (error) {
                return res.status(400).json({
                    success: false,
                    message: error
                });
            }

            if (Object.keys(cleanData).length === 0) {
                return res.status(400).json({
                    success: false,
                    message: '수정할 기술 스택 필드가 필요합니다.'
                });
            }

            const nextIsFeatured = hasOwn(cleanData, 'is_featured')
                ? cleanData.is_featured
                : Boolean(existingSkill.is_featured);
            const nextDisplayOrder = hasOwn(cleanData, 'display_order')
                ? cleanData.display_order
                : existingSkill.display_order;
            if (nextIsFeatured && nextDisplayOrder) {
                const conflictingSkill = await Skills.getByDisplayOrder(nextDisplayOrder, skillId);
                if (conflictingSkill) {
                    return res.status(400).json({
                        success: false,
                        message: `표시 순서 ${nextDisplayOrder}은(는) 이미 사용 중입니다. 다른 순서를 선택해주세요.`
                    });
                }
            }
            
            await Skills.updateSkill(skillId, cleanData);

            const updatedSkill = await Skills.getSkillById(skillId);
            CacheUtils.invalidateResources('skills');

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
            CacheUtils.invalidateResources('skills');

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
            const isFeatured = toBooleanOrNull(req.body?.is_featured);

            if (isFeatured === null) {
                return res.status(400).json({
                    success: false,
                    message: '추천 상태는 boolean 값이어야 합니다.'
                });
            }
            await Skills.updateSkill(skillId, { is_featured: isFeatured });
            CacheUtils.invalidateResources('skills');

            res.json({
                success: true,
                message: `기술 스택이 ${isFeatured ? '추천' : '일반'} 상태로 변경되었습니다.`
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
            const displayOrder = parseNumber(req.body?.display_order, { integer: true, min: 0 });

            if (displayOrder === undefined || displayOrder === null) {
                return res.status(400).json({
                    success: false,
                    message: '표시 순서는 0 이상의 숫자여야 합니다.'
                });
            }
            await Skills.updateSkill(skillId, { display_order: displayOrder });
            CacheUtils.invalidateResources('skills');

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
