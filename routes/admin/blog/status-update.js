const {
    BlogPosts,
    toBooleanOrNull
} = require('./common');
const {
    findBlogPostBySlug,
    parseBlogPostSlugParam
} = require('./lookup');

const buildStatusError = (statusCode, message) => ({
    error: {
        statusCode,
        message
    }
});

const updateBlogPostStatusBySlug = async ({
    body,
    field,
    falseMessage,
    invalidMessage,
    slug,
    trueMessage
}) => {
    const value = toBooleanOrNull(body?.[field]);
    if (value === null) {
        return buildStatusError(400, invalidMessage);
    }

    const parsed = parseBlogPostSlugParam(slug);
    if (parsed.error) {
        return parsed;
    }

    const lookup = await findBlogPostBySlug(parsed.postSlug);
    if (lookup.error) {
        return lookup;
    }

    const updatedPost = await BlogPosts.update(lookup.post.id, {
        [field]: value
    });

    return {
        data: updatedPost,
        message: value ? trueMessage : falseMessage
    };
};

module.exports = {
    updateBlogPostStatusBySlug
};
