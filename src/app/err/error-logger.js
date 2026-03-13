/**
 * Client-side Error Logger
 * Captures and sends errors to backend for analytics
 */

const API_BASE_ERROR = window.location.origin;;

class ErrorLogger {
  constructor() {
    this.sessionId = this.generateSessionId();
    this.errorQueue = [];
    this.maxQueueSize = 50;
    this.sendInterval = 10000; // Send errors every 10 seconds
    this.isEnabled = true;
    
    this.init();
  }

  /**
   * Initialize error logger
   */
  init() {
    // Capture global errors
    window.addEventListener('error', (event) => {
      this.logError({
        type: 'javascript_error',
        message: event.message,
        filename: event.filename,
        lineNumber: event.lineno,
        columnNumber: event.colno,
        stack: event.error?.stack,
        severity: 'error'
      });
    });

    // Capture unhandled promise rejections
    window.addEventListener('unhandledrejection', (event) => {
      this.logError({
        type: 'unhandled_rejection',
        message: event.reason?.message || String(event.reason),
        stack: event.reason?.stack,
        severity: 'error'
      });
    });

    // Capture console errors
    const originalConsoleError = console.error;
    console.error = (...args) => {
      this.logError({
        type: 'console_error',
        message: args.join(' '),
        severity: 'warning'
      });
      originalConsoleError.apply(console, args);
    };

    // Send errors periodically
    setInterval(() => {
      this.flushErrors();
    }, this.sendInterval);

    // Send errors before page unload
    window.addEventListener('beforeunload', () => {
      this.flushErrors(true);
    });

    console.log('[ErrorLogger] Initialized');
  }

  /**
   * Generate unique session ID
   */
  generateSessionId() {
    return 'session_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
  }

  /**
   * Log an error
   * @param {object} error - Error details
   */
  logError(error) {
    if (!this.isEnabled) return;

    const errorData = {
      ...error,
      timestamp: new Date().toISOString(),
      sessionId: this.sessionId,
      url: window.location.href,
      userAgent: navigator.userAgent,
      viewport: {
        width: window.innerWidth,
        height: window.innerHeight
      },
      browser: this.getBrowserInfo(),
      userId: this.getUserId()
    };

    this.errorQueue.push(errorData);

    // If queue is full, send immediately
    if (this.errorQueue.length >= this.maxQueueSize) {
      this.flushErrors();
    }

    // Log to console in development
    if (window.location.hostname === 'localhost') {
      console.warn('[ErrorLogger] Captured error:', errorData);
    }
  }

  /**
   * Log custom error
   * @param {string} message - Error message
   * @param {object} details - Additional details
   */
  logCustomError(message, details = {}) {
    this.logError({
      type: 'custom_error',
      message,
      ...details,
      severity: details.severity || 'error'
    });
  }

  /**
   * Log API error
   * @param {string} endpoint - API endpoint
   * @param {number} status - HTTP status code
   * @param {string} message - Error message
   */
  logApiError(endpoint, status, message) {
    this.logError({
      type: 'api_error',
      message: `API Error: ${endpoint}`,
      endpoint,
      status,
      errorMessage: message,
      severity: status >= 500 ? 'error' : 'warning'
    });
  }

  /**
   * Log WebRTC error
   * @param {string} message - Error message
   * @param {object} details - Additional details
   */
  logWebRTCError(message, details = {}) {
    this.logError({
      type: 'webrtc_error',
      message,
      ...details,
      severity: 'error'
    });
  }

  /**
   * Log performance issue
   * @param {string} metric - Performance metric
   * @param {number} value - Metric value
   */
  logPerformance(metric, value) {
    this.logError({
      type: 'performance',
      message: `Performance issue: ${metric}`,
      metric,
      value,
      severity: 'info'
    });
  }

  /**
   * Flush error queue to backend
   * @param {boolean} sync - Use synchronous request (for beforeunload)
   */
  flushErrors(sync = false) {
    if (this.errorQueue.length === 0) return;

    const errors = [...this.errorQueue];
    this.errorQueue = [];

    const payload = {
      errors,
      metadata: {
        sessionId: this.sessionId,
        timestamp: new Date().toISOString(),
        totalErrors: errors.length
      }
    };

    if (sync) {
      // Use sendBeacon for synchronous sending (more reliable on page unload)
      if (navigator.sendBeacon) {
        const blob = new Blob([JSON.stringify(payload)], { type: 'application/json' });
        navigator.sendBeacon(`${API_BASE_ERROR}/api/logs/errors`, blob);
      }
    } else {
      // Normal async request
      fetch(`${API_BASE_ERROR}/api/logs/errors`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        credentials: 'include',
        body: JSON.stringify(payload)
      })
      .catch(err => {
        console.error('[ErrorLogger] Failed to send errors:', err);
      });
    }
  }

  /**
   * Get browser information
   */
  getBrowserInfo() {
    const ua = navigator.userAgent;
    let browserName = 'Unknown';
    let browserVersion = 'Unknown';

    if (ua.includes('Firefox/')) {
      browserName = 'Firefox';
      browserVersion = ua.match(/Firefox\/(\d+\.\d+)/)?.[1] || 'Unknown';
    } else if (ua.includes('Chrome/')) {
      browserName = 'Chrome';
      browserVersion = ua.match(/Chrome\/(\d+\.\d+)/)?.[1] || 'Unknown';
    } else if (ua.includes('Safari/') && !ua.includes('Chrome')) {
      browserName = 'Safari';
      browserVersion = ua.match(/Version\/(\d+\.\d+)/)?.[1] || 'Unknown';
    } else if (ua.includes('Edge/')) {
      browserName = 'Edge';
      browserVersion = ua.match(/Edge\/(\d+\.\d+)/)?.[1] || 'Unknown';
    }

    return {
      name: browserName,
      version: browserVersion,
      platform: navigator.platform,
      language: navigator.language
    };
  }

  /**
   * Get user ID from session/cookie
   */
  getUserId() {
    // Try to get from localStorage
    try {
      const user = JSON.parse(localStorage.getItem('user') || '{}');
      return user.userId || user.id || 'anonymous';
    } catch {
      return 'anonymous';
    }
  }

  /**
   * Enable/disable error logging
   * @param {boolean} enabled - Enable logging
   */
  setEnabled(enabled) {
    this.isEnabled = enabled;
  }

  /**
   * Clear error queue
   */
  clearQueue() {
    this.errorQueue = [];
  }

  /**
   * Get current queue size
   */
  getQueueSize() {
    return this.errorQueue.length;
  }
}

// Create global instance
const errorLogger = new ErrorLogger();

// Make globally accessible
window.ErrorLogger = errorLogger;

// Export for modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = errorLogger;
}

// Helper functions for easy access
window.logError = (message, details) => errorLogger.logCustomError(message, details);
window.logApiError = (endpoint, status, message) => errorLogger.logApiError(endpoint, status, message);
window.logWebRTCError = (message, details) => errorLogger.logWebRTCError(message, details);
window.ErrorPerformance = (message, details) => ErrorLogger.logPerformance('page_load', 3500); 

console.log('[ErrorLogger] Ready - Errors will be sent to backend');