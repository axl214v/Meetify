-- ==========================================
-- Meetify Database Initialization Script
-- ==========================================

-- Create database if not exists
CREATE DATABASE IF NOT EXISTS meetify CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE meetify;

-- ==========================================
-- Users Table
-- ==========================================
CREATE TABLE IF NOT EXISTS users (
    id INT PRIMARY KEY AUTO_INCREMENT,
    email VARCHAR(255) UNIQUE NOT NULL,
    username VARCHAR(100) NOT NULL,
    password VARCHAR(255) NOT NULL,
    avatar_url VARCHAR(500),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_email (email),
    INDEX idx_username (username)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ==========================================
-- Conferences Table
-- ==========================================
CREATE TABLE IF NOT EXISTS conferences (
    id INT PRIMARY KEY AUTO_INCREMENT,
    name VARCHAR(255) NOT NULL,
    host_id INT NOT NULL,
    password VARCHAR(255),
    max_participants INT DEFAULT 50,
    is_public BOOLEAN DEFAULT TRUE,
    description TEXT,
    start_time DATETIME,
    end_time DATETIME,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (host_id) REFERENCES users(id) ON DELETE CASCADE,
    INDEX idx_host (host_id),
    INDEX idx_created (created_at),
    INDEX idx_start_time (start_time),
    INDEX idx_public (is_public)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ==========================================
-- Conference Members Table
-- ==========================================
CREATE TABLE IF NOT EXISTS conference_members (
    id INT PRIMARY KEY AUTO_INCREMENT,
    conference_id INT NOT NULL,
    user_id INT NOT NULL,
    joined_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    left_at TIMESTAMP NULL,
    FOREIGN KEY (conference_id) REFERENCES conferences(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    UNIQUE KEY unique_member (conference_id, user_id),
    INDEX idx_conference (conference_id),
    INDEX idx_user (user_id),
    INDEX idx_joined (joined_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ==========================================
-- Initial Data (Optional)
-- ==========================================

-- Create demo user (password: demo123)
-- Password hash for 'demo123' (bcrypt with 10 rounds)
INSERT IGNORE INTO users (email, username, password) VALUES 
('demo@meetify.com', 'Demo User', '$2b$10$rBV2d1EA2lPPFbBvRZDPl.uqL2HyJxJ8VvZ1p5X6Y1L1C5l8X5X5X');

-- ==========================================
-- Success Message
-- ==========================================
SELECT 'Database initialized successfully!' AS message;