const { hasOwn } = require('./payload');

const getNextFeaturedState = (payload, existingSkill) => (
    hasOwn(payload, 'is_featured')
        ? payload.is_featured
        : Boolean(existingSkill?.is_featured)
);

const getNextDisplayOrder = (payload, existingSkill) => (
    hasOwn(payload, 'display_order')
        ? payload.display_order
        : existingSkill?.display_order
);

const findFeaturedDisplayOrderConflict = async (
    Skills,
    payload,
    { existingSkill = null, excludeSkillId = null } = {}
) => {
    const nextIsFeatured = getNextFeaturedState(payload, existingSkill);
    const nextDisplayOrder = getNextDisplayOrder(payload, existingSkill);

    if (!nextIsFeatured || !nextDisplayOrder) {
        return null;
    }

    return await Skills.getByDisplayOrder(nextDisplayOrder, excludeSkillId);
};

const buildDisplayOrderConflictMessage = (displayOrder) => (
    `표시 순서 ${displayOrder}은(는) 이미 사용 중입니다. 다른 순서를 선택해주세요.`
);

module.exports = {
    buildDisplayOrderConflictMessage,
    findFeaturedDisplayOrderConflict,
    getNextDisplayOrder,
    getNextFeaturedState
};
export {};
