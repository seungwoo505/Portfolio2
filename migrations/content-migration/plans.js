const tablePlans = [
    {
        source: 'personal_info',
        target: 'personal_info',
        columns: [
            'id', 'name', 'full_name', 'title', 'bio', 'about', 'email', 'phone', 'location',
            'avatar_url', 'resume_url', 'github_url', 'linkedin_url', 'twitter_url', 'instagram_url',
            'created_at', 'updated_at'
        ]
    },
    {
        source: 'social_links',
        target: 'social_links',
        columns: ['id', 'platform', 'url', 'icon', 'display_order', 'is_active', 'created_at', 'updated_at']
    },
    {
        source: 'skill_categories',
        target: 'skill_categories',
        columns: ['id', 'name', 'description', 'display_order', 'created_at', 'updated_at']
    },
    {
        source: 'skills',
        target: 'skills',
        columns: [
            'id', 'category_id', 'name', 'proficiency_level', 'years_of_experience', 'icon',
            'color', 'display_order', 'is_featured', 'created_at', 'updated_at'
        ]
    },
    {
        source: 'tags',
        target: 'tags',
        columns: ['id', 'name', 'slug', 'description', 'color', 'type', 'usage_count', 'created_at', 'updated_at']
    },
    {
        source: 'projects',
        target: 'projects',
        columns: [
            'id', 'title', 'slug', 'description', 'short_description', 'detailed_description',
            'content', 'excerpt', 'meta_description', 'meta_keywords', 'thumbnail_image',
            'featured_image', 'demo_url', 'github_url', 'technologies', 'start_date', 'end_date',
            'is_ongoing', 'status', 'is_featured', 'is_published', 'display_order',
            'created_at', 'updated_at'
        ],
        defaults: {
            view_count: 0
        }
    },
    {
        source: 'project_images',
        target: 'project_images',
        columns: ['id', 'project_id', 'image_url', 'alt_text', 'display_order', 'created_at']
    },
    {
        source: 'project_skills',
        target: 'project_skills',
        columns: ['project_id', 'skill_id', 'created_at']
    },
    {
        source: 'blog_posts',
        target: 'blog_posts',
        columns: [
            'id', 'uuid', 'title', 'slug', 'excerpt', 'content', 'featured_image',
            'is_published', 'is_featured', 'reading_time', 'meta_title', 'meta_description',
            'meta_keywords', 'published_at', 'created_at', 'updated_at'
        ],
        defaults: {
            view_count: 0
        }
    },
    {
        source: 'tag_usage',
        target: 'tag_usage',
        columns: ['tag_id', 'content_type', 'content_id', 'created_at'],
        where: "content_type IN ('project', 'blog_post')"
    },
    {
        source: 'experiences',
        target: 'experiences',
        columns: [
            'id', 'type', 'title', 'company_or_institution', 'location', 'description',
            'start_date', 'end_date', 'is_current', 'display_order', 'created_at', 'updated_at'
        ]
    },
    {
        source: 'interests',
        target: 'interests',
        columns: ['id', 'title', 'description', 'icon', 'category', 'display_order', 'created_at', 'updated_at']
    },
    {
        source: 'site_settings',
        target: 'site_settings',
        columns: ['setting_key', 'setting_value', 'setting_type', 'is_public', 'description', 'created_at', 'updated_at'],
        where: 'is_public = TRUE'
    }
];

module.exports = {
    tablePlans
};
