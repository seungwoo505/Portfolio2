const { generateSlug } = require('./common');

module.exports = {
    /**
     * @description 프로젝트 제목을 기반으로 URL 슬러그를 생성한다.
     * @param {string} title 생성할 프로젝트 제목
     * @returns {string} 정규화된 슬러그
     */
    generateSlug(title) {
        return generateSlug(title, 'project');
    }
};
export {};
