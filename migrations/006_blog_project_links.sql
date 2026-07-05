CREATE TABLE IF NOT EXISTS blog_project_links (
    blog_post_id INT NOT NULL,
    project_id BIGINT UNSIGNED NOT NULL,
    display_order INT NOT NULL DEFAULT 0,
    relation_label VARCHAR(120),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (blog_post_id, project_id),
    INDEX idx_blog_project_links_project (project_id, display_order),
    INDEX idx_blog_project_links_post_order (blog_post_id, display_order),
    CONSTRAINT fk_blog_project_links_post FOREIGN KEY (blog_post_id) REFERENCES blog_posts(id) ON DELETE CASCADE,
    CONSTRAINT fk_blog_project_links_project FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
