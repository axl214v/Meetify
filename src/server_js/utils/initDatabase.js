// utils/initDatabase.js
/**
 * Database Initialization Script
 * Runs on server startup to create tables if they don't exist
 */

const db = require('../config/database');

const initDatabase = async () => {
  console.log('[Database] Initializing database schema...');

  return new Promise((resolve, reject) => {
    // Helper function to execute query
    const executeQuery = (query, description) => {
      return new Promise((resolveQuery, rejectQuery) => {
        db.query(query, (error, results) => {
          if (error) {
            console.error(`[Database] Error creating ${description}:`, error.message);
            rejectQuery(error);
          } else {
            console.log(`[Database] ✓ ${description} ready`);
            resolveQuery(results);
          }
        });
      });
    };

    // Execute all queries sequentially
    (async () => {
      try {
        // Create users table
        await executeQuery(`
          CREATE TABLE IF NOT EXISTS users (
            id INT PRIMARY KEY AUTO_INCREMENT,
            email VARCHAR(255) UNIQUE NOT NULL,
            username VARCHAR(100) NOT NULL,
            password VARCHAR(255) NOT NULL,
            avatar_url VARCHAR(500),
            role VARCHAR(20) DEFAULT 'user',
            email_verified BOOLEAN DEFAULT FALSE,
            email_verification_token VARCHAR(255),
            email_verification_expires DATETIME,
            trust_level TINYINT DEFAULT 0,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            INDEX idx_email (email),
            INDEX idx_username (username)
          ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        `, 'Users table');

        // Add missing columns to existing users table (MySQL 8.0 compatible — check information_schema first)
        const addColumnIfMissing = async (column, definition) => {
          const [cols] = await db.promise().query(
            `SELECT 1 FROM information_schema.COLUMNS
             WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'users' AND COLUMN_NAME = ?`,
            [column]
          );
          if (!cols.length) {
            await executeQuery(`ALTER TABLE users ADD COLUMN ${column} ${definition}`, `users.${column}`);
          }
        };
        await addColumnIfMissing('role', "VARCHAR(20) DEFAULT 'user'");
        await addColumnIfMissing('email_verified', 'BOOLEAN DEFAULT FALSE');
        await addColumnIfMissing('email_verification_token', 'VARCHAR(255)');
        await addColumnIfMissing('email_verification_expires', 'DATETIME');
        await addColumnIfMissing('trust_level', 'TINYINT DEFAULT 0');

        // Create conferences table
        await executeQuery(`
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
        `, 'Conferences table');

        // Create conference_members table
        await executeQuery(`
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
        `, 'Conference members table');

        // Create password_reset_tokens table
        await executeQuery(`
          CREATE TABLE IF NOT EXISTS password_reset_tokens (
            id INT PRIMARY KEY AUTO_INCREMENT,
            user_id INT NOT NULL,
            token VARCHAR(255) UNIQUE NOT NULL,
            expires_at DATETIME NOT NULL,
            used BOOLEAN DEFAULT FALSE,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
            INDEX idx_token (token),
            INDEX idx_user (user_id)
          ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        `, 'Password reset tokens table');

        // Create app_settings table (SMTP and other admin settings)
        await executeQuery(`
          CREATE TABLE IF NOT EXISTS app_settings (
            \`key\` VARCHAR(100) PRIMARY KEY,
            value TEXT,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
          ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        `, 'App settings table');

        // Create notifications table (admin broadcast notifications)
        await executeQuery(`
          CREATE TABLE IF NOT EXISTS notifications (
            id INT PRIMARY KEY AUTO_INCREMENT,
            title VARCHAR(255) NOT NULL,
            message TEXT NOT NULL,
            category ENUM('info', 'update', 'maintenance', 'warning') DEFAULT 'info',
            created_by INT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL,
            INDEX idx_created (created_at)
          ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        `, 'Notifications table');

        // Migrate existing notifications table: change created_by FK to ON DELETE SET NULL
        const [notifFkRows] = await db.promise().query(`
            SELECT CONSTRAINT_NAME FROM information_schema.KEY_COLUMN_USAGE
            WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'notifications'
              AND COLUMN_NAME = 'created_by' AND REFERENCED_TABLE_NAME = 'users'
        `);
        if (notifFkRows.length) {
            const [colRows] = await db.promise().query(`
                SELECT IS_NULLABLE FROM information_schema.COLUMNS
                WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'notifications'
                  AND COLUMN_NAME = 'created_by'
            `);
            if (colRows.length && colRows[0].IS_NULLABLE === 'NO') {
                const fkName = notifFkRows[0].CONSTRAINT_NAME;
                await db.promise().query(`ALTER TABLE notifications DROP FOREIGN KEY \`${fkName}\``);
                await db.promise().query(`ALTER TABLE notifications MODIFY COLUMN created_by INT NULL`);
                await db.promise().query(`ALTER TABLE notifications ADD FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL`);
                console.log('[Database] ✓ notifications.created_by migrated to ON DELETE SET NULL');
            }
        }

        console.log('[Database] ✅ Database initialization complete!');
        resolve(true);

      } catch (error) {
        console.error('[Database] ❌ Initialization failed:', error.message);
        reject(error);
      }
    })();
  });
};

module.exports = initDatabase;