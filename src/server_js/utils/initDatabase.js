// utils/initDatabase.js
/**
 * Database Initialization Script
 * Runs on server startup to create tables if they don't exist
 */

const db = require('../config/database');

const initDatabase = async () => {
  console.log('[Database] Initializing database schema...');

  try {
    // Create users table
    await db.promise().query(`
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
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    console.log('[Database] ✓ Users table ready');

    // Create conferences table
    await db.promise().query(`
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
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    console.log('[Database] ✓ Conferences table ready');

    // Create conference_members table
    await db.promise().query(`
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
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    console.log('[Database] ✓ Conference members table ready');

    console.log('[Database] ✅ Database initialization complete!');
    return true;

  } catch (error) {
    console.error('[Database] ❌ Initialization failed:', error.message);
    throw error;
  }
};

module.exports = initDatabase;