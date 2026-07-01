-- Shop-style portfolio schema
-- Target: MySQL 8.x
-- Purpose: A fresh schema for presenting portfolio projects like catalog items.
-- Excludes real commerce concerns such as carts, orders, payments, inventory, and shipping.
--
-- Optional database bootstrap:
-- CREATE DATABASE portfolio_shop CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
-- USE portfolio_shop;

SET NAMES utf8mb4;

CREATE TABLE IF NOT EXISTS personal_info (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    display_name VARCHAR(120) NOT NULL,
    full_name VARCHAR(150),
    headline VARCHAR(200),
    bio TEXT,
    about LONGTEXT,
    email VARCHAR(255),
    phone VARCHAR(50),
    location VARCHAR(255),
    avatar_url VARCHAR(500),
    resume_url VARCHAR(500),
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS social_links (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    platform VARCHAR(80) NOT NULL,
    label VARCHAR(120),
    url VARCHAR(500) NOT NULL,
    icon VARCHAR(100),
    display_order INT NOT NULL DEFAULT 0,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_social_links_active_order (is_active, display_order)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS site_settings (
    setting_key VARCHAR(120) PRIMARY KEY,
    setting_value LONGTEXT,
    setting_type VARCHAR(30) NOT NULL DEFAULT 'string',
    is_public BOOLEAN NOT NULL DEFAULT FALSE,
    description TEXT,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_site_settings_public (is_public, setting_key)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS projects (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    slug VARCHAR(255) NOT NULL,
    summary TEXT,
    description TEXT,
    content_html LONGTEXT,
    content_json LONGTEXT,
    content_text LONGTEXT,
    status ENUM('planning', 'in_progress', 'completed', 'on_hold', 'archived') NOT NULL DEFAULT 'completed',
    project_type ENUM('web_app', 'admin_tool', 'backend', 'fullstack', 'performance', 'case_study', 'experiment', 'other') NOT NULL DEFAULT 'web_app',
    role_summary VARCHAR(255),
    start_date DATE,
    end_date DATE,
    is_ongoing BOOLEAN NOT NULL DEFAULT FALSE,
    is_published BOOLEAN NOT NULL DEFAULT FALSE,
    is_featured BOOLEAN NOT NULL DEFAULT FALSE,
    display_order INT NOT NULL DEFAULT 0,
    view_count INT UNSIGNED NOT NULL DEFAULT 0,
    meta_title VARCHAR(255),
    meta_description TEXT,
    meta_keywords TEXT,
    published_at DATETIME,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uq_projects_slug (slug),
    INDEX idx_projects_public_order (is_published, is_featured, display_order, published_at),
    INDEX idx_projects_type_status (project_type, status),
    FULLTEXT KEY ft_projects_search (title, summary, description, content_text, meta_keywords)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS project_catalog_profiles (
    project_id BIGINT UNSIGNED PRIMARY KEY,
    catalog_title VARCHAR(255),
    catalog_summary TEXT,
    catalog_label VARCHAR(80),
    catalog_status VARCHAR(80),
    catalog_badge VARCHAR(80),
    catalog_image_url VARCHAR(500),
    catalog_accent_color VARCHAR(20),
    catalog_cta_label VARCHAR(80) NOT NULL DEFAULT '상세 보기',
    catalog_priority INT NOT NULL DEFAULT 0,
    price_label VARCHAR(80) DEFAULT 'Portfolio',
    difficulty_label VARCHAR(80),
    impact_summary VARCHAR(255),
    primary_metric_label VARCHAR(80),
    primary_metric_value VARCHAR(120),
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_project_catalog_priority (catalog_priority),
    CONSTRAINT fk_project_catalog_profiles_project
        FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS project_catalog_sections (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(120) NOT NULL,
    slug VARCHAR(140) NOT NULL,
    description TEXT,
    section_type ENUM('featured', 'new_arrivals', 'popular', 'case_study', 'stack', 'custom') NOT NULL DEFAULT 'custom',
    display_order INT NOT NULL DEFAULT 0,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uq_project_catalog_sections_slug (slug),
    INDEX idx_project_catalog_sections_active_order (is_active, display_order)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS project_catalog_section_items (
    section_id BIGINT UNSIGNED NOT NULL,
    project_id BIGINT UNSIGNED NOT NULL,
    display_order INT NOT NULL DEFAULT 0,
    custom_label VARCHAR(80),
    custom_summary TEXT,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (section_id, project_id),
    INDEX idx_project_catalog_section_items_order (section_id, display_order),
    INDEX idx_project_catalog_section_items_project (project_id),
    CONSTRAINT fk_project_catalog_section_items_section
        FOREIGN KEY (section_id) REFERENCES project_catalog_sections(id) ON DELETE CASCADE,
    CONSTRAINT fk_project_catalog_section_items_project
        FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS project_metrics (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    project_id BIGINT UNSIGNED NOT NULL,
    metric_group VARCHAR(80) NOT NULL DEFAULT 'spec',
    label VARCHAR(120) NOT NULL,
    value VARCHAR(160) NOT NULL,
    unit VARCHAR(40),
    description TEXT,
    display_order INT NOT NULL DEFAULT 0,
    is_highlighted BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_project_metrics_project_order (project_id, display_order),
    INDEX idx_project_metrics_highlight (project_id, is_highlighted, display_order),
    CONSTRAINT fk_project_metrics_project
        FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS project_links (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    project_id BIGINT UNSIGNED NOT NULL,
    link_type ENUM('demo', 'github', 'docs', 'case_study', 'figma', 'download', 'other') NOT NULL DEFAULT 'other',
    label VARCHAR(120) NOT NULL,
    url VARCHAR(500) NOT NULL,
    display_order INT NOT NULL DEFAULT 0,
    is_primary BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_project_links_project_order (project_id, display_order),
    INDEX idx_project_links_primary (project_id, is_primary),
    CONSTRAINT fk_project_links_project
        FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS project_images (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    project_id BIGINT UNSIGNED NOT NULL,
    image_type ENUM('catalog', 'cover', 'gallery', 'detail', 'og') NOT NULL DEFAULT 'gallery',
    image_url VARCHAR(500) NOT NULL,
    alt_text VARCHAR(255),
    caption VARCHAR(255),
    width INT UNSIGNED,
    height INT UNSIGNED,
    display_order INT NOT NULL DEFAULT 0,
    is_primary BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_project_images_project_type_order (project_id, image_type, display_order),
    INDEX idx_project_images_primary (project_id, is_primary),
    CONSTRAINT fk_project_images_project
        FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS tags (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    slug VARCHAR(120) NOT NULL,
    description TEXT,
    color VARCHAR(20),
    type ENUM('project', 'blog', 'general') NOT NULL DEFAULT 'project',
    usage_count INT UNSIGNED NOT NULL DEFAULT 0,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uq_tags_slug (slug),
    INDEX idx_tags_type_usage (type, usage_count)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS project_tags (
    project_id BIGINT UNSIGNED NOT NULL,
    tag_id BIGINT UNSIGNED NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (project_id, tag_id),
    INDEX idx_project_tags_tag (tag_id),
    CONSTRAINT fk_project_tags_project
        FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
    CONSTRAINT fk_project_tags_tag
        FOREIGN KEY (tag_id) REFERENCES tags(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS skill_categories (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    slug VARCHAR(120) NOT NULL,
    description TEXT,
    display_order INT NOT NULL DEFAULT 0,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uq_skill_categories_slug (slug),
    INDEX idx_skill_categories_order (display_order)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS skills (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    category_id BIGINT UNSIGNED,
    name VARCHAR(100) NOT NULL,
    slug VARCHAR(120) NOT NULL,
    description TEXT,
    proficiency_level TINYINT UNSIGNED DEFAULT 0,
    years_of_experience DECIMAL(4,1),
    icon VARCHAR(255),
    color VARCHAR(20),
    display_order INT NOT NULL DEFAULT 0,
    is_featured BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uq_skills_slug (slug),
    INDEX idx_skills_category_order (category_id, display_order),
    INDEX idx_skills_featured_order (is_featured, display_order),
    CONSTRAINT fk_skills_category
        FOREIGN KEY (category_id) REFERENCES skill_categories(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS project_skills (
    project_id BIGINT UNSIGNED NOT NULL,
    skill_id BIGINT UNSIGNED NOT NULL,
    importance ENUM('primary', 'secondary', 'supporting') NOT NULL DEFAULT 'secondary',
    display_order INT NOT NULL DEFAULT 0,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (project_id, skill_id),
    INDEX idx_project_skills_skill (skill_id),
    INDEX idx_project_skills_project_order (project_id, importance, display_order),
    CONSTRAINT fk_project_skills_project
        FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
    CONSTRAINT fk_project_skills_skill
        FOREIGN KEY (skill_id) REFERENCES skills(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT IGNORE INTO project_catalog_sections (name, slug, description, section_type, display_order, is_active)
VALUES
    ('추천 프로젝트', 'featured-projects', '가장 먼저 보여줄 대표 프로젝트입니다.', 'featured', 10, TRUE),
    ('신규 입고', 'new-arrivals', '최근 업데이트된 프로젝트입니다.', 'new_arrivals', 20, TRUE),
    ('인기 프로젝트', 'popular-projects', '조회수와 반응이 높은 프로젝트입니다.', 'popular', 30, TRUE),
    ('케이스 스터디', 'case-studies', '문제 해결 과정과 성과를 함께 보여주는 프로젝트입니다.', 'case_study', 40, TRUE);
