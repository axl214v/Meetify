const Conference = require('../models/Conference');
const User = require('../models/User');
const bcrypt = require('bcrypt');
const { conferenceLimits } = require('../config/webrtc');

/**
 * Conference Service
 * Handles business logic for conference operations
 */

class ConferenceService {
  /**
   * Validate conference creation data
   * @param {object} data - Conference data
   * @returns {object} { valid: boolean, errors: Array }
   */
  static validateConferenceData(data) {
    const errors = [];

    // Name validation
    if (!data.name || data.name.trim().length === 0) {
      errors.push('Conference name is required');
    } else if (data.name.length > 255) {
      errors.push('Conference name is too long (max 255 characters)');
    }

    // Description validation
    if (data.description && data.description.length > 1000) {
      errors.push('Description is too long (max 1000 characters)');
    }

    // Max participants validation
    if (data.maxParticipants) {
      const max = parseInt(data.maxParticipants);
      if (isNaN(max) || max < conferenceLimits.minParticipants || max > conferenceLimits.maxParticipants) {
        errors.push(`Max participants must be between ${conferenceLimits.minParticipants} and ${conferenceLimits.maxParticipants}`);
      }
    }

    // Time validation
    if (data.startTime && data.endTime) {
      const start = new Date(data.startTime);
      const end = new Date(data.endTime);
      
      if (isNaN(start.getTime()) || isNaN(end.getTime())) {
        errors.push('Invalid date format');
      } else if (start >= end) {
        errors.push('End time must be after start time');
      }
    }

    // Password validation
    if (data.password && data.password.length < 4) {
      errors.push('Password must be at least 4 characters');
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }

  /**
   * Create a new conference
   * @param {object} conferenceData - Conference data
   * @param {string} hostId - Host user ID
   * @returns {Promise<object>} Created conference
   */
  static async createConference(conferenceData, hostId) {
    try {
      // Validate data
      const validation = this.validateConferenceData(conferenceData);
      if (!validation.valid) {
        throw new Error(validation.errors.join(', '));
      }

      // Create conference
      const conference = await Conference.create({
        name: conferenceData.name.trim(),
        hostId,
        password: conferenceData.password || null,
        maxParticipants: conferenceData.maxParticipants || conferenceLimits.defaultMaxParticipants,
        isPublic: conferenceData.isPublic !== undefined ? conferenceData.isPublic : true,
        description: conferenceData.description ? conferenceData.description.trim() : null,
        startTime: conferenceData.startTime || null,
        endTime: conferenceData.endTime || null
      });

      // Automatically add host as participant
      await Conference.addParticipant(conference.id, hostId);

      return conference;
    } catch (error) {
      console.error('ConferenceService.createConference error:', error);
      throw error;
    }
  }

  /**
   * Check if user can join conference
   * @param {number} conferenceId - Conference ID
   * @param {string} userId - User ID
   * @param {string} password - Optional password
   * @returns {Promise<object>} { allowed: boolean, reason: string }
   */
  static async canJoinConference(conferenceId, userId, password = null) {
    try {
      const conference = await Conference.findById(conferenceId);

      if (!conference) {
        return { allowed: false, reason: 'Conference not found' };
      }

      // Check if already participant
      const isParticipant = await Conference.isParticipant(conferenceId, userId);
      if (isParticipant) {
        return { allowed: true, alreadyJoined: true };
      }

      // Check if host
      if (conference.host_id === userId) {
        return { allowed: true, isHost: true };
      }

      // Check if conference has ended
      if (conference.end_time && new Date(conference.end_time) < new Date()) {
        return { allowed: false, reason: 'Conference has ended' };
      }

      // Check if conference has started (for scheduled conferences)
      if (conference.start_time && new Date(conference.start_time) > new Date()) {
        return { allowed: false, reason: 'Conference has not started yet' };
      }

      // Check password (bcrypt-hashed)
      if (conference.password) {
        if (!password) {
          return { allowed: false, reason: 'Password required', requiresPassword: true };
        }
        const passwordMatch = await bcrypt.compare(password, conference.password);
        if (!passwordMatch) {
          return { allowed: false, reason: 'Incorrect password', requiresPassword: true };
        }
      }

      // Приватные конференции требуют верифицированного email (trust_level >= 1)
      if (!conference.is_public) {
        const user = await User.findById(userId);
        if (!user || (user.trust_level || 0) < 1) {
          return { allowed: false, reason: 'Email verification required', requiresVerification: true };
        }
      }

      // Check participant limit
      const participantCount = await Conference.getParticipantCount(conferenceId);
      if (conference.max_participants && participantCount >= conference.max_participants) {
        return { allowed: false, reason: 'Conference is full' };
      }

      return { allowed: true };
    } catch (error) {
      console.error('ConferenceService.canJoinConference error:', error);
      throw error;
    }
  }

  /**
   * Get conference with participant information
   * @param {number} conferenceId - Conference ID
   * @param {string} userId - User ID requesting info
   * @returns {Promise<object>} Conference with metadata
   */
  static async getConferenceWithMetadata(conferenceId, userId) {
    try {
      const conference = await Conference.findById(conferenceId);

      if (!conference) {
        return null;
      }

      // Get participant count
      const participantCount = await Conference.getParticipantCount(conferenceId);

      // Check user's role
      const isHost = conference.host_id === userId;
      const isParticipant = await Conference.isParticipant(conferenceId, userId);

      // Remove password from response unless user is host
      const conferenceData = { ...conference };
      if (!isHost) {
        delete conferenceData.password;
      }

      return {
        ...conferenceData,
        participantCount,
        isHost,
        isParticipant,
        status: this.getConferenceStatus(conference)
      };
    } catch (error) {
      console.error('ConferenceService.getConferenceWithMetadata error:', error);
      throw error;
    }
  }

  /**
   * Get conference status
   * @param {object} conference - Conference object
   * @returns {string} Status: 'scheduled', 'ongoing', 'ended'
   */
  static getConferenceStatus(conference) {
    const now = new Date();

    if (conference.end_time && new Date(conference.end_time) < now) {
      return 'ended';
    }

    if (conference.start_time) {
      const start = new Date(conference.start_time);
      if (start > now) {
        return 'scheduled';
      } else if (start <= now && (!conference.end_time || new Date(conference.end_time) >= now)) {
        return 'ongoing';
      }
    }

    return 'active';
  }

  /**
   * Update conference settings (host only)
   * @param {number} conferenceId - Conference ID
   * @param {string} userId - User ID
   * @param {object} updateData - Data to update
   * @returns {Promise<object>} Updated conference
   */
  static async updateConferenceSettings(conferenceId, userId, updateData) {
    try {
      const conference = await Conference.findById(conferenceId);

      if (!conference) {
        throw new Error('Conference not found');
      }

      // Check if user is host
      if (conference.host_id !== userId) {
        throw new Error('Only host can update conference settings');
      }

      // Validate update data
      const validation = this.validateConferenceData({
        name: updateData.name || conference.name,
        description: updateData.description,
        maxParticipants: updateData.maxParticipants,
        startTime: updateData.startTime,
        endTime: updateData.endTime
      });

      if (!validation.valid) {
        throw new Error(validation.errors.join(', '));
      }

      // Check if reducing max participants below current count
      if (updateData.maxParticipants) {
        const participantCount = await Conference.getParticipantCount(conferenceId);
        if (participantCount > parseInt(updateData.maxParticipants)) {
          throw new Error(`Cannot set max participants lower than current count (${participantCount})`);
        }
      }

      // Update conference
      const updatedConference = await Conference.update(conferenceId, updateData);

      return updatedConference;
    } catch (error) {
      console.error('ConferenceService.updateConferenceSettings error:', error);
      throw error;
    }
  }

  /**
   * End conference (host only)
   * @param {number} conferenceId - Conference ID
   * @param {string} userId - User ID
   * @returns {Promise<boolean>} Success
   */
  static async endConference(conferenceId, userId) {
    try {
      const conference = await Conference.findById(conferenceId);

      if (!conference) {
        throw new Error('Conference not found');
      }

      // Check if user is host
      if (conference.host_id !== userId) {
        throw new Error('Only host can end conference');
      }

      // Set end time to now
      await Conference.update(conferenceId, {
        endTime: new Date()
      });

      // TODO: notify participants via socket that conference has ended
      return true;
    } catch (error) {
      console.error('ConferenceService.endConference error:', error);
      throw error;
    }
  }

  /**
   * Clean up old conferences (scheduled task)
   * @param {number} daysOld - Delete conferences older than this many days
   * @returns {Promise<number>} Number of deleted conferences
   */
  static async cleanupOldConferences(daysOld = 30) {
    // TODO: implement Conference.deleteOlderThan and wire this up to a scheduler.
    console.log(`[ConferenceService] Cleanup task stub — would delete conferences older than ${daysOld} days`);
    return 0;
  }

  /**
   * Get conference statistics
   * @param {number} conferenceId - Conference ID
   * @returns {Promise<object>} Conference statistics
   */
  static async getConferenceStats(conferenceId) {
    try {
      return await Conference.getConferenceStats(conferenceId);
    } catch (error) {
      console.error('ConferenceService.getConferenceStats error:', error);
      throw error;
    }
  }

  /**
   * Check if user has permission to perform action
   * @param {number} conferenceId - Conference ID
   * @param {string} userId - User ID
   * @param {string} action - Action: 'view', 'join', 'edit', 'delete', 'kick'
   * @returns {Promise<boolean>} Has permission
   */
  static async hasPermission(conferenceId, userId, action) {
    try {
      const conference = await Conference.findById(conferenceId);

      if (!conference) {
        return false;
      }

      const isHost = conference.host_id === userId;
      const isParticipant = await Conference.isParticipant(conferenceId, userId);

      switch (action) {
        case 'view':
          return conference.is_public || isHost || isParticipant;
        
        case 'join':
          return conference.is_public || isHost;
        
        case 'edit':
        case 'delete':
        case 'kick':
          return isHost;
        
        default:
          return false;
      }
    } catch (error) {
      console.error('ConferenceService.hasPermission error:', error);
      return false;
    }
  }
}

module.exports = ConferenceService;