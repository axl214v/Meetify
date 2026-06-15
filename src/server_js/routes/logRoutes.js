const express = require('express');
const router = express.Router();
const fs = require('fs').promises;
const path = require('path');
const { authenticateToken, requireRole } = require('../middleware/auth');

// ============================================
// Error Logging Controller
// ============================================

/**
 * Log directory setup
 */
const LOG_DIR = path.join(__dirname, '../logs');
const ERROR_LOG_FILE = path.join(LOG_DIR, 'client-errors.log');
const STATS_FILE = path.join(LOG_DIR, 'error-stats.json');

// Create logs directory if it doesn't exist
(async () => {
  try {
    await fs.mkdir(LOG_DIR, { recursive: true });
    console.log('[Logs] Directory initialized:', LOG_DIR);
  } catch (error) {
    console.error('[Logs] Failed to create directory:', error);
  }
})();

/**
 * POST /api/logs/errors
 * Receive client errors and log them
 */
router.post('/errors', async (req, res) => {
  try {
    const { errors, metadata } = req.body;

    if (!errors || !Array.isArray(errors)) {
      return res.status(400).json({ message: 'Invalid error data' });
    }

    // Process each error
    for (const error of errors) {
      await logError(error, metadata);
    }

    // Update statistics
    await updateErrorStats(errors);

    res.status(200).json({ 
      message: 'Errors logged successfully',
      count: errors.length
    });

  } catch (error) {
    console.error('[Logs] Error logging failed:', error);
    res.status(500).json({ message: 'Failed to log errors' });
  }
});

/**
 * GET /api/logs/errors
 * Get error logs (admin only)
 */
router.get('/errors', authenticateToken, requireRole('admin'), async (req, res) => {
  try {
    const { limit = 100, type, severity, date } = req.query;

    // Read error log file
    const logContent = await fs.readFile(ERROR_LOG_FILE, 'utf8').catch(() => '');
    const lines = logContent.split('\n').filter(Boolean);

    // Parse JSON logs
    let errors = lines.map(line => {
      try {
        return JSON.parse(line);
      } catch {
        return null;
      }
    }).filter(Boolean);

    // Apply filters
    if (type) {
      errors = errors.filter(e => e.type === type);
    }

    if (severity) {
      errors = errors.filter(e => e.severity === severity);
    }

    if (date) {
      const targetDate = new Date(date).toISOString().split('T')[0];
      errors = errors.filter(e => e.timestamp.startsWith(targetDate));
    }

    // Limit results
    errors = errors.slice(0, parseInt(limit));

    res.json({
      errors,
      total: errors.length
    });

  } catch (error) {
    console.error('[Logs] Error reading logs:', error);
    res.status(500).json({ message: 'Failed to read logs' });
  }
});

/**
 * GET /api/logs/stats
 * Get error statistics (admin only)
 */
router.get('/stats', authenticateToken, requireRole('admin'), async (req, res) => {
  try {
    const stats = await getErrorStats();
    res.json(stats);
  } catch (error) {
    console.error('[Logs] Error reading stats:', error);
    res.status(500).json({ message: 'Failed to read stats' });
  }
});

/**
 * DELETE /api/logs/errors
 * Clear error logs (admin only)
 */
router.delete('/errors', authenticateToken, requireRole('admin'), async (req, res) => {
  try {
    await fs.writeFile(ERROR_LOG_FILE, '');
    await fs.writeFile(STATS_FILE, JSON.stringify({
      totalErrors: 0,
      byType: {},
      bySeverity: {},
      byDate: {},
      topErrors: []
    }, null, 2));

    res.json({ message: 'Error logs cleared successfully' });
  } catch (error) {
    console.error('[Logs] Error clearing logs:', error);
    res.status(500).json({ message: 'Failed to clear logs' });
  }
});

// ============================================
// Helper Functions
// ============================================

/**
 * Log error to file
 */
async function logError(error, metadata) {
  const logEntry = {
    ...error,
    metadata,
    serverTimestamp: new Date().toISOString()
  };

  // Format log line
  const logLine = JSON.stringify(logEntry) + '\n';

  // Append to log file
  await fs.appendFile(ERROR_LOG_FILE, logLine);

  // Also log to console with colors
  const severityColors = {
    error: '\x1b[31m', // Red
    warning: '\x1b[33m', // Yellow
    info: '\x1b[36m', // Cyan
  };

  const color = severityColors[error.severity] || '\x1b[0m';
  const reset = '\x1b[0m';

  console.log(`${color}[Client Error]${reset} [${error.type}] ${error.message}`);
  if (error.stack) {
    console.log(`  Stack: ${error.stack.split('\n')[0]}`);
  }
  console.log(`  URL: ${error.url}`);
  console.log(`  Browser: ${error.browser?.name} ${error.browser?.version}`);
  console.log(`  User: ${error.userId}`);
  console.log(`  Session: ${error.sessionId}`);
  console.log('---');
}

/**
 * Update error statistics
 */
async function updateErrorStats(errors) {
  try {
    // Read current stats
    let stats = await fs.readFile(STATS_FILE, 'utf8')
      .then(data => JSON.parse(data))
      .catch(() => ({
        totalErrors: 0,
        byType: {},
        bySeverity: {},
        byDate: {},
        byBrowser: {},
        byUrl: {},
        topErrors: [],
        lastUpdated: null
      }));

    // Update stats
    stats.totalErrors += errors.length;
    stats.lastUpdated = new Date().toISOString();

    for (const error of errors) {
      // By type
      stats.byType[error.type] = (stats.byType[error.type] || 0) + 1;

      // By severity
      stats.bySeverity[error.severity] = (stats.bySeverity[error.severity] || 0) + 1;

      // By date
      const date = error.timestamp.split('T')[0];
      stats.byDate[date] = (stats.byDate[date] || 0) + 1;

      // By browser
      const browser = error.browser?.name || 'Unknown';
      stats.byBrowser[browser] = (stats.byBrowser[browser] || 0) + 1;

      // By URL
      const url = new URL(error.url).pathname;
      stats.byUrl[url] = (stats.byUrl[url] || 0) + 1;

      // Top errors
      const errorKey = `${error.type}: ${error.message}`;
      const existing = stats.topErrors.find(e => e.message === errorKey);
      if (existing) {
        existing.count++;
        existing.lastSeen = error.timestamp;
      } else {
        stats.topErrors.push({
          message: errorKey,
          type: error.type,
          severity: error.severity,
          count: 1,
          firstSeen: error.timestamp,
          lastSeen: error.timestamp
        });
      }
    }

    // Sort top errors by count
    stats.topErrors.sort((a, b) => b.count - a.count);
    stats.topErrors = stats.topErrors.slice(0, 20); // Keep top 20

    // Keep only last 30 days in byDate
    const dates = Object.keys(stats.byDate).sort();
    if (dates.length > 30) {
      const oldDates = dates.slice(0, dates.length - 30);
      oldDates.forEach(date => delete stats.byDate[date]);
    }

    // Write updated stats
    await fs.writeFile(STATS_FILE, JSON.stringify(stats, null, 2));

  } catch (error) {
    console.error('[Logs] Failed to update stats:', error);
  }
}

/**
 * Get error statistics
 */
async function getErrorStats() {
  try {
    const stats = await fs.readFile(STATS_FILE, 'utf8')
      .then(data => JSON.parse(data))
      .catch(() => ({
        totalErrors: 0,
        byType: {},
        bySeverity: {},
        byDate: {},
        byBrowser: {},
        byUrl: {},
        topErrors: [],
        lastUpdated: null
      }));

    return stats;
  } catch (error) {
    console.error('[Logs] Failed to get stats:', error);
    throw error;
  }
}

/**
 * Rotate log files (call this periodically)
 */
async function rotateLogs() {
  try {
    const stats = await fs.stat(ERROR_LOG_FILE).catch(() => null);
    
    if (stats && stats.size > 10 * 1024 * 1024) { // 10MB
      const timestamp = new Date().toISOString().replace(/:/g, '-').split('.')[0];
      const archiveFile = path.join(LOG_DIR, `client-errors-${timestamp}.log`);
      
      await fs.rename(ERROR_LOG_FILE, archiveFile);
      console.log('[Logs] Log file rotated:', archiveFile);
    }
  } catch (error) {
    console.error('[Logs] Failed to rotate logs:', error);
  }
}

// Rotate logs daily
setInterval(rotateLogs, 24 * 60 * 60 * 1000);

module.exports = router;