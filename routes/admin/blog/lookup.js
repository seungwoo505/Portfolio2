const {
    BlogPosts,
    parseSlugParam
} = require('./common');

const parseBlogPostSlugParam = (slug) => {
    const postSlug = parseSlugParam(slug);
    if (!postSlug) {
        return {
            error: {
                statusCode: 400,
                message: '유효한 slug가 필요합니다.'
            }
        };
    }

    return { postSlug };
};

const findBlogPostBySlug = async (postSlug) => {
    const post = await BlogPosts.getBySlugAdmin(postSlug);
    if (!post) {
        return {
            error: {
                statusCode: 404,
                message: '포스트를 찾을 수 없습니다.'
            }
        };
    }

    return { post };
};

module.exports = {
    findBlogPostBySlug,
    parseBlogPostSlugParam
};
