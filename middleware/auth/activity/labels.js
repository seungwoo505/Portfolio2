const actionLabels = {
    admin_login: '로그인',
    admin_login_failed: '로그인 실패',
    admin_logout: '로그아웃',
    change_password: '비밀번호 변경',
    create_admin: '관리자 생성',
    update_admin: '관리자 수정',
    delete_admin: '관리자 삭제',
    create_blog_post: '블로그 생성',
    update_blog_post: '블로그 수정',
    publish_blog_post: '블로그 발행',
    feature_blog_post: '블로그 추천 변경',
    delete_blog_post: '블로그 삭제',
    create_project: '프로젝트 생성',
    update_project: '프로젝트 수정',
    delete_project: '프로젝트 삭제',
    create_tag: '태그 생성',
    update_tag: '태그 수정',
    delete_tag: '태그 삭제',
    mark_contact_read: '연락처 읽음',
    delete_contact: '연락처 삭제',
    update_settings: '설정 수정',
    upload_image: '이미지 업로드',
    delete_image: '이미지 삭제',
    create_skill_category: '스킬 카테고리 생성',
    delete_skill_category: '스킬 카테고리 삭제',
    create_skill: '기술 스택 생성',
    update_skill: '기술 스택 수정',
    delete_skill: '기술 스택 삭제',
    toggle_skill_featured: '기술 스택 추천 변경',
    update_skill_order: '기술 스택 순서 변경',
    update_personal_info: '개인 정보 수정',
    create_social_link: '소셜 링크 생성',
    update_social_link: '소셜 링크 수정',
    delete_social_link: '소셜 링크 삭제',
    create_experience: '경력 생성',
    update_experience: '경력 수정',
    delete_experience: '경력 삭제',
    create_interest: '관심사 생성',
    update_interest: '관심사 수정',
    delete_interest: '관심사 삭제'
};

const actionVerbs = {
    create: '생성',
    update: '수정',
    delete: '삭제',
    publish: '발행',
    feature: '추천 변경',
    upload: '업로드',
    mark: '상태 변경',
    toggle: '추천 변경',
    change: '변경'
};

const resourceLabels = {
    admin: '관리자',
    users: '관리자',
    projects: '프로젝트',
    blog: '블로그',
    posts: '블로그',
    tags: '태그',
    contacts: '연락처',
    settings: '설정',
    images: '이미지',
    uploads: '파일',
    skills: '기술 스택',
    'personal-info': '개인 정보',
    'social-links': '소셜 링크',
    experiences: '경력',
    interests: '관심사'
};

const getActionLabel = (action) => {
    const actionPrefix = action.split('_')[0];
    return actionVerbs[actionPrefix] || actionLabels[action] || action.replace(/_/g, ' ');
};

const getResourceLabel = (resourceType) => resourceLabels[resourceType] || resourceType;

module.exports = {
    actionLabels,
    actionVerbs,
    getActionLabel,
    getResourceLabel,
    resourceLabels
};
