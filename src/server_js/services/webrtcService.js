const { 
  rtcConfiguration, 
  getIceServers,
  conferenceLimits,
  getRecommendedQuality,
  bitrateSettings 
} = require('../config/webrtc');

/**
 * WebRTC Service
 * Handles WebRTC-related business logic and utilities
 */

class WebRTCService {
  /**
   * Get ICE servers configuration for client
   * @param {string} userId - User ID (for analytics/logging)
   * @returns {object} ICE servers configuration
   */
  static getIceServersForClient(userId = null) {
    const iceServers = getIceServers();
    
    if (userId) {
      console.log(`[WebRTC] Providing ICE servers to user ${userId}`);
    }

    return {
      iceServers,
      iceTransportPolicy: rtcConfiguration.iceTransportPolicy
    };
  }

  /**
   * Get recommended media constraints based on conference size
   * @param {number} participantCount - Number of participants
   * @returns {object} Media constraints
   */
  static getRecommendedConstraints(participantCount) {
    const quality = getRecommendedQuality(participantCount);
    
    const constraints = {
      quality,
      video: this.getVideoConstraints(quality),
      audio: this.getAudioConstraints(),
      bitrate: this.getRecommendedBitrate(participantCount)
    };

    console.log(`[WebRTC] Recommended quality for ${participantCount} participants: ${quality}`);
    
    return constraints;
  }

  /**
   * Get video constraints for specific quality
   * @param {string} quality - Quality preset
   * @returns {object} Video constraints
   */
  static getVideoConstraints(quality = 'high') {
    const presets = {
      low: {
        width: { ideal: 320 },
        height: { ideal: 240 },
        frameRate: { ideal: 15 }
      },
      medium: {
        width: { ideal: 640 },
        height: { ideal: 480 },
        frameRate: { ideal: 24 }
      },
      high: {
        width: { ideal: 1280 },
        height: { ideal: 720 },
        frameRate: { ideal: 30 }
      },
      hd: {
        width: { ideal: 1920 },
        height: { ideal: 1080 },
        frameRate: { ideal: 30 }
      }
    };

    return presets[quality] || presets.high;
  }

  /**
   * Get audio constraints
   * @returns {object} Audio constraints
   */
  static getAudioConstraints() {
    return {
      echoCancellation: true,
      noiseSuppression: true,
      autoGainControl: true,
      sampleRate: 48000,
      channelCount: 1
    };
  }

  /**
   * Get recommended bitrate based on participant count
   * @param {number} participantCount - Number of participants
   * @returns {object} Bitrate settings
   */
  static getRecommendedBitrate(participantCount) {
    let videoMultiplier = 1;
    
    if (participantCount > 10) {
      videoMultiplier = 0.5;
    } else if (participantCount > 5) {
      videoMultiplier = 0.7;
    } else if (participantCount > 2) {
      videoMultiplier = 0.85;
    }

    return {
      video: {
        min: Math.floor(bitrateSettings.video.min * videoMultiplier),
        ideal: Math.floor(bitrateSettings.video.ideal * videoMultiplier),
        max: Math.floor(bitrateSettings.video.max * videoMultiplier)
      },
      audio: bitrateSettings.audio
    };
  }

  /**
   * Validate SDP (Session Description Protocol)
   * @param {string} sdp - SDP string
   * @param {string} type - 'offer' or 'answer'
   * @returns {object} { valid: boolean, error: string }
   */
  static validateSDP(sdp, type) {
    if (!sdp || typeof sdp !== 'string') {
      return { valid: false, error: 'SDP must be a non-empty string' };
    }

    if (!type || !['offer', 'answer'].includes(type)) {
      return { valid: false, error: 'Type must be "offer" or "answer"' };
    }

    // Basic SDP validation
    if (!sdp.includes('v=0')) {
      return { valid: false, error: 'Invalid SDP: missing version' };
    }

    if (!sdp.includes('m=')) {
      return { valid: false, error: 'Invalid SDP: missing media description' };
    }

    return { valid: true };
  }

  /**
   * Validate ICE candidate
   * @param {object} candidate - ICE candidate object
   * @returns {object} { valid: boolean, error: string }
   */
  static validateICECandidate(candidate) {
    if (!candidate || typeof candidate !== 'object') {
      return { valid: false, error: 'Candidate must be an object' };
    }

    if (!candidate.candidate || typeof candidate.candidate !== 'string') {
      return { valid: false, error: 'Candidate must have a valid candidate string' };
    }

    if (typeof candidate.sdpMLineIndex !== 'number') {
      return { valid: false, error: 'Candidate must have a valid sdpMLineIndex' };
    }

    return { valid: true };
  }

  /**
   * Calculate optimal layout for video grid
   * @param {number} participantCount - Number of participants
   * @returns {object} Layout configuration
   */
  static calculateVideoLayout(participantCount) {
    if (participantCount <= 1) {
      return { rows: 1, cols: 1, aspectRatio: '16:9' };
    }
    
    if (participantCount <= 2) {
      return { rows: 1, cols: 2, aspectRatio: '16:9' };
    }
    
    if (participantCount <= 4) {
      return { rows: 2, cols: 2, aspectRatio: '16:9' };
    }
    
    if (participantCount <= 6) {
      return { rows: 2, cols: 3, aspectRatio: '16:9' };
    }
    
    if (participantCount <= 9) {
      return { rows: 3, cols: 3, aspectRatio: '16:9' };
    }
    
    if (participantCount <= 12) {
      return { rows: 3, cols: 4, aspectRatio: '16:9' };
    }
    
    if (participantCount <= 16) {
      return { rows: 4, cols: 4, aspectRatio: '16:9' };
    }
    
    // For larger conferences, switch to list view
    return { rows: 5, cols: 5, aspectRatio: '4:3', mode: 'list' };
  }

  /**
   * Estimate bandwidth requirements
   * @param {number} participantCount - Number of participants
   * @param {string} quality - Quality preset
   * @returns {object} Bandwidth estimate in kbps
   */
  static estimateBandwidth(participantCount, quality = 'high') {
    const bitrates = {
      low: 250,
      medium: 500,
      high: 1000,
      hd: 2000
    };

    const videoBitrate = bitrates[quality] || bitrates.high;
    const audioBitrate = 32; // kbps

    // Upload: 1 video stream + 1 audio stream
    const upload = videoBitrate + audioBitrate;

    // Download: (N-1) video streams + (N-1) audio streams
    const download = (participantCount - 1) * (videoBitrate + audioBitrate);

    return {
      upload: Math.ceil(upload),
      download: Math.ceil(download),
      total: Math.ceil(upload + download),
      unit: 'kbps',
      recommended: Math.ceil((upload + download) * 1.2) // Add 20% overhead
    };
  }

  /**
   * Check if bandwidth is sufficient
   * @param {number} availableBandwidth - Available bandwidth in kbps
   * @param {number} participantCount - Number of participants
   * @param {string} quality - Quality preset
   * @returns {object} { sufficient: boolean, recommended: number }
   */
  static checkBandwidth(availableBandwidth, participantCount, quality = 'high') {
    const estimate = this.estimateBandwidth(participantCount, quality);
    
    return {
      sufficient: availableBandwidth >= estimate.recommended,
      required: estimate.recommended,
      available: availableBandwidth,
      deficit: Math.max(0, estimate.recommended - availableBandwidth)
    };
  }

  /**
   * Get optimal quality based on available bandwidth
   * @param {number} bandwidth - Available bandwidth in kbps
   * @param {number} participantCount - Number of participants
   * @returns {string} Quality preset
   */
  static getOptimalQuality(bandwidth, participantCount) {
    const qualities = ['hd', 'high', 'medium', 'low'];
    
    for (const quality of qualities) {
      const estimate = this.estimateBandwidth(participantCount, quality);
      if (bandwidth >= estimate.recommended) {
        return quality;
      }
    }
    
    return 'low';
  }

  /**
   * Generate WebRTC statistics report
   * @param {object} stats - RTCStatsReport
   * @returns {object} Formatted statistics
   */
  static formatStats(stats) {
    const report = {
      timestamp: new Date().toISOString(),
      video: {
        bytesSent: 0,
        bytesReceived: 0,
        framesSent: 0,
        framesReceived: 0,
        framesDropped: 0
      },
      audio: {
        bytesSent: 0,
        bytesReceived: 0,
        packetsLost: 0
      },
      connection: {
        roundTripTime: 0,
        jitter: 0,
        packetsLost: 0
      }
    };

    // Parse RTCStatsReport (this is a simplified version)
    // Actual implementation would need to iterate through stats object
    
    return report;
  }

  /**
   * Check if device supports WebRTC
   * @returns {object} Support information
   */
  static checkWebRTCSupport() {
    const support = {
      webrtc: false,
      getUserMedia: false,
      RTCPeerConnection: false,
      RTCDataChannel: false,
      screenCapture: false
    };

    if (typeof navigator !== 'undefined') {
      support.getUserMedia = !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia);
      support.RTCPeerConnection = !!(window.RTCPeerConnection);
      support.RTCDataChannel = !!(window.RTCDataChannel);
      support.screenCapture = !!(navigator.mediaDevices && navigator.mediaDevices.getDisplayMedia);
      support.webrtc = support.getUserMedia && support.RTCPeerConnection;
    }

    return support;
  }

  /**
   * Log WebRTC metrics (for monitoring)
   * @param {string} userId - User ID
   * @param {string} conferenceId - Conference ID
   * @param {object} metrics - Metrics to log
   */
  static logMetrics(userId, conferenceId, metrics) {
    console.log(`[WebRTC Metrics] User: ${userId}, Conference: ${conferenceId}`, {
      timestamp: new Date().toISOString(),
      ...metrics
    });

    // TODO: Send to analytics service or store in database
  }

  /**
   * Handle WebRTC error
   * @param {Error} error - Error object
   * @param {string} context - Context where error occurred
   * @returns {object} Error details
   */
  static handleWebRTCError(error, context = 'unknown') {
    const errorDetails = {
      context,
      message: error.message,
      name: error.name,
      timestamp: new Date().toISOString()
    };

    // Map common WebRTC errors to user-friendly messages
    const errorMessages = {
      'NotFoundError': 'Camera or microphone not found',
      'NotAllowedError': 'Permission denied for camera/microphone',
      'NotReadableError': 'Camera or microphone is already in use',
      'OverconstrainedError': 'Camera or microphone does not meet requirements',
      'TypeError': 'Invalid WebRTC configuration',
      'InvalidStateError': 'Connection in invalid state'
    };

    errorDetails.userMessage = errorMessages[error.name] || 'An error occurred with your connection';

    console.error(`[WebRTC Error] ${context}:`, errorDetails);

    return errorDetails;
  }
}

module.exports = WebRTCService;