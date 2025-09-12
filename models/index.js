// 모든 모델들을 import하고 export하는 메인 파일
const PersonalInfo = require('./personal-info');
const SocialLinks = require('./social-links');
const Skills = require('./skills');
const Projects = require('./projects');
const BlogPosts = require('./blog-posts');
const BlogTags = require('./blog-tags');
const Tags = require('./tags');
const ContactMessages = require('./contact-messages');
const Experiences = require('./experiences');
const Interests = require('./interests');
const SiteSettings = require('./site-settings');
const AdminUsers = require('./admin-users');
const AdminActivityLogs = require('./admin-activity-logs');

// DB 유틸리티 함수들도 export
const { executeQuery, executeQuerySingle } = require('./db-utils');

module.exports = {
    // 모델들
    PersonalInfo,
    SocialLinks,
    Skills,
    Projects,
    BlogPosts,
    BlogTags,
    Tags,
    ContactMessages,
    Experiences,
    Interests,
    SiteSettings,
    AdminUsers,
    AdminActivityLogs,
    
    // 유틸리티 함수들
    executeQuery,
    executeQuerySingle
};