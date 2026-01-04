/**
 * WebRTC Configuration
 * This file contains all WebRTC-related configuration including STUN/TURN servers
 */

// ICE Servers Configuration

/**
 * Public STUN servers (free)
 * STUN servers help with NAT traversal by discovering public IP addresses
 */
const PUBLIC_STUN_SERVERS = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
  { urls: 'stun:stun2.l.google.com:19302' },
  { urls: 'stun:stun3.l.google.com:19302' },
  { urls: 'stun:stun4.l.google.com:19302' }
];

/**
 * TURN servers configuration (for production)
 * TURN servers relay media when direct peer-to-peer connection fails
 * 
 * For production, you should set up your own TURN server or use a service like:
 * - Twilio (https://www.twilio.com/stun-turn)
 * - Xirsys (https://xirsys.com/)
 * - CoTURN (open source self-hosted)
 */
const TURN_SERVERS = [
  // Example TURN server configuration (replace with your own)
  // {
  //   urls: 'turn:your-turn-server.com:3478',
  //   username: process.env.TURN_USERNAME || 'username',
  //   credential: process.env.TURN_PASSWORD || 'password'
  // },
  // {
  //   urls: 'turns:your-turn-server.com:5349',
  //   username: process.env.TURN_USERNAME || 'username',
  //   credential: process.env.TURN_PASSWORD || 'password'
  // }
];

/**
 * Get complete ICE servers configuration
 * @returns {Array} Array of ICE server configurations
 */
function getIceServers() {
  const iceServers = [...PUBLIC_STUN_SERVERS];
  
  // Add TURN servers if configured
  if (TURN_SERVERS.length > 0) {
    iceServers.push(...TURN_SERVERS);
  }
  
  return iceServers;
}

// WebRTC Peer Connection Configuration

/**
 * RTCPeerConnection configuration
 */
const rtcConfiguration = {
  iceServers: getIceServers(),
  
  // ICE transport policy
  // 'all' (default) - Use both STUN and TURN
  // 'relay' - Only use TURN (more privacy but requires TURN server)
  iceTransportPolicy: process.env.ICE_TRANSPORT_POLICY || 'all',
  
  // Bundle policy - how to bundle media streams
  bundlePolicy: 'max-bundle',
  
  // RTCP mux policy - multiplex RTP and RTCP on single port
  rtcpMuxPolicy: 'require',
  
  // ICE candidate pool size
  iceCandidatePoolSize: 10
};

// Media Constraints

/**
 * Default video constraints
 */
const videoConstraints = {
  width: { 
    min: 640, 
    ideal: 1280, 
    max: 1920 
  },
  height: { 
    min: 480, 
    ideal: 720, 
    max: 1080 
  },
  frameRate: { 
    ideal: 30, 
    max: 60 
  },
  facingMode: 'user' // 'user' for front camera, 'environment' for back
};

/**
 * Default audio constraints
 */
const audioConstraints = {
  echoCancellation: true,
  noiseSuppression: true,
  autoGainControl: true,
  sampleRate: 48000,
  channelCount: 1
};

/**
 * Screen share constraints
 */
const screenShareConstraints = {
  video: {
    cursor: 'always',
    width: { max: 1920 },
    height: { max: 1080 },
    frameRate: { max: 30 }
  },
  audio: false // Set to true if you want to capture system audio
};

// Conference Limits

/**
 * Conference participant limits
 */
const conferenceLimits = {
  maxParticipants: parseInt(process.env.MAX_CONFERENCE_PARTICIPANTS) || 50,
  defaultMaxParticipants: 50,
  minParticipants: 2,
  
  // Maximum video streams to render simultaneously
  maxVideoStreams: 25,
  
  // Maximum audio streams
  maxAudioStreams: 50
};

// Quality Settings

/**
 * Video quality presets
 */
const videoQualityPresets = {
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

/**
 * Adaptive bitrate settings
 */
const bitrateSettings = {
  video: {
    min: 100000,    // 100 kbps
    ideal: 1000000, // 1 Mbps
    max: 2500000    // 2.5 Mbps
  },
  audio: {
    min: 6000,   // 6 kbps
    ideal: 32000, // 32 kbps
    max: 128000  // 128 kbps
  }
};

// ============================================
// Timeouts and Intervals
// ============================================

const timeouts = {
  // ICE gathering timeout
  iceGatheringTimeout: 10000, // 10 seconds
  
  // Connection timeout
  connectionTimeout: 30000, // 30 seconds
  
  // Reconnection attempt timeout
  reconnectionTimeout: 5000, // 5 seconds
  
  // Max reconnection attempts
  maxReconnectionAttempts: 5,
  
  // Stats collection interval
  statsInterval: 5000, // 5 seconds
  
  // Keep-alive ping interval
  keepAliveInterval: 30000 // 30 seconds
};

// ============================================
// Export Configuration
// ============================================

module.exports = {
  // ICE Servers
  getIceServers,
  PUBLIC_STUN_SERVERS,
  TURN_SERVERS,
  
  // Peer Connection
  rtcConfiguration,
  
  // Media Constraints
  videoConstraints,
  audioConstraints,
  screenShareConstraints,
  
  // Limits
  conferenceLimits,
  
  // Quality Settings
  videoQualityPresets,
  bitrateSettings,
  
  // Timeouts
  timeouts,
  
  // Helper Functions
  
  /**
   * Get media constraints based on quality preset
   * @param {string} quality - Quality preset: 'low', 'medium', 'high', 'hd'
   * @returns {object} Media constraints
   */
  getMediaConstraints(quality = 'high') {
    return {
      video: {
        ...videoConstraints,
        ...(videoQualityPresets[quality] || videoQualityPresets.high)
      },
      audio: audioConstraints
    };
  },
  
  /**
   * Validate conference participant count
   * @param {number} count - Participant count
   * @returns {boolean} True if valid
   */
  isValidParticipantCount(count) {
    return count >= conferenceLimits.minParticipants && 
           count <= conferenceLimits.maxParticipants;
  },
  
  /**
   * Get recommended quality based on participant count
   * @param {number} participantCount - Number of participants
   * @returns {string} Recommended quality preset
   */
  getRecommendedQuality(participantCount) {
    if (participantCount <= 2) return 'hd';
    if (participantCount <= 5) return 'high';
    if (participantCount <= 10) return 'medium';
    return 'low';
  }
};