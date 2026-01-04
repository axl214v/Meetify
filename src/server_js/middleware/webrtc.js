const WebRTCService = require('../services/webrtcService');
const ConferenceService = require('../services/conferenceService');

/**
 * Middleware to validate WebRTC signaling data
 */
const validateSignalingData = (req, res, next) => {
  const { type, data } = req.body;

  if (!type || !['offer', 'answer', 'ice-candidate'].includes(type)) {
    return res.status(400).json({
      message: 'Invalid signaling type',
      error: 'Type must be one of: offer, answer, ice-candidate'
    });
  }

  // Validate based on type
  switch (type) {
    case 'offer':
    case 'answer':
      if (!data || !data.sdp || !data.type) {
        return res.status(400).json({
          message: 'Invalid SDP data',
          error: 'SDP must contain sdp and type fields'
        });
      }

      const sdpValidation = WebRTCService.validateSDP(data.sdp, data.type);
      if (!sdpValidation.valid) {
        return res.status(400).json({
          message: 'Invalid SDP',
          error: sdpValidation.error
        });
      }
      break;

    case 'ice-candidate':
      if (!data || !data.candidate) {
        return res.status(400).json({
          message: 'Invalid ICE candidate',
          error: 'Candidate data is required'
        });
      }

      const candidateValidation = WebRTCService.validateICECandidate(data);
      if (!candidateValidation.valid) {
        return res.status(400).json({
          message: 'Invalid ICE candidate',
          error: candidateValidation.error
        });
      }
      break;
  }

  next();
};

/**
 * Middleware to check conference access for WebRTC
 */
const checkConferenceAccess = async (req, res, next) => {
  try {
    const conferenceId = req.params.conferenceId || req.body.conferenceId;
    const userId = req.user.userId;

    if (!conferenceId) {
      return res.status(400).json({
        message: 'Conference ID is required'
      });
    }

    // Check if user has permission to join
    const accessCheck = await ConferenceService.canJoinConference(
      conferenceId, 
      userId
    );

    if (!accessCheck.allowed) {
      return res.status(403).json({
        message: accessCheck.reason || 'Access denied to conference',
        requiresPassword: accessCheck.requiresPassword || false
      });
    }

    // Attach conference info to request
    req.conferenceAccess = accessCheck;
    
    next();
  } catch (error) {
    console.error('Conference access check error:', error);
    res.status(500).json({
      message: 'Failed to check conference access'
    });
  }
};

/**
 * Middleware to validate participant limit
 */
const checkParticipantLimit = async (req, res, next) => {
  try {
    const conferenceId = req.params.conferenceId || req.body.conferenceId;
    const Conference = require('../models/Conference');

    const conference = await Conference.findById(conferenceId);
    
    if (!conference) {
      return res.status(404).json({
        message: 'Conference not found'
      });
    }

    if (conference.max_participants) {
      const participantCount = await Conference.getParticipantCount(conferenceId);
      
      if (participantCount >= conference.max_participants) {
        return res.status(403).json({
          message: 'Conference is full',
          maxParticipants: conference.max_participants,
          currentParticipants: participantCount
        });
      }
    }

    next();
  } catch (error) {
    console.error('Participant limit check error:', error);
    res.status(500).json({
      message: 'Failed to check participant limit'
    });
  }
};

/**
 * Middleware to log WebRTC metrics
 */
const logWebRTCMetrics = (req, res, next) => {
  const userId = req.user?.userId;
  const conferenceId = req.params.conferenceId || req.body.conferenceId;
  
  if (userId && conferenceId) {
    const metrics = {
      endpoint: req.path,
      method: req.method,
      userAgent: req.get('user-agent'),
      ip: req.ip
    };

    WebRTCService.logMetrics(userId, conferenceId, metrics);
  }

  next();
};

/**
 * Middleware to provide ICE servers configuration
 */
const provideIceServers = (req, res, next) => {
  const userId = req.user?.userId;
  req.iceServers = WebRTCService.getIceServersForClient(userId);
  next();
};

/**
 * Middleware to get recommended media constraints
 */
const getRecommendedConstraints = async (req, res, next) => {
  try {
    const conferenceId = req.params.conferenceId || req.body.conferenceId;
    const Conference = require('../models/Conference');

    if (conferenceId) {
      const participantCount = await Conference.getParticipantCount(conferenceId);
      req.recommendedConstraints = WebRTCService.getRecommendedConstraints(participantCount + 1);
    }

    next();
  } catch (error) {
    console.error('Get recommended constraints error:', error);
    // Continue without recommended constraints
    next();
  }
};

/**
 * Rate limiter for WebRTC signaling
 */
const rateLimit = require('express-rate-limit');

const signalingRateLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 100, // Max 100 signaling messages per minute
  message: {
    message: 'Too many signaling requests',
    error: 'Rate limit exceeded. Please try again later.'
  },
  standardHeaders: true,
  legacyHeaders: false,
  // Use user ID as key
  keyGenerator: (req) => {
    return req.user?.userId || req.ip;
  }
});

module.exports = {
  validateSignalingData,
  checkConferenceAccess,
  checkParticipantLimit,
  logWebRTCMetrics,
  provideIceServers,
  getRecommendedConstraints,
  signalingRateLimiter
};