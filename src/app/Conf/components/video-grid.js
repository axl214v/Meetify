class VideoGrid {
  constructor(containerId) {
    this.container = document.getElementById(containerId);
    this.videos = new Map(); // userId -> video element
    this.layout = { rows: 1, cols: 1 };
    
    if (!this.container) {
      throw new Error(`Container with id "${containerId}" not found`);
    }
    
    this.init();
  }


   // Initialize the video grid

  init() {
    this.container.classList.add('video-grid-container');
    this.updateLayout();
  }

  /**
   * Add a video stream to the grid
   * @param {string} userId - User ID
   * @param {MediaStream} stream - Media stream
   * @param {object} options - Additional options (userName, isLocal, etc.)
   */
  addVideo(userId, stream, options = {}) {
    // Remove existing video if any
    if (this.videos.has(userId)) {
      this.removeVideo(userId);
    }

    const {
      userName = `User ${userId.substring(0, 8)}`,
      isLocal = false,
      isMuted = false,
      isVideoOff = false
    } = options;

    // Create video container
    const videoContainer = document.createElement('div');
    videoContainer.id = `video-${userId}`;
    videoContainer.className = 'video-container';
    videoContainer.dataset.userId = userId;

    // Create video element
    const video = document.createElement('video');
    video.srcObject = stream;
    video.autoplay = true;
    video.playsinline = true;
    video.muted = isLocal; // Mute local video to prevent echo

    // Create overlay with participant info
    const overlay = document.createElement('div');
    overlay.className = 'video-overlay';
    
    const nameTag = document.createElement('span');
    nameTag.className = 'participant-name';
    nameTag.textContent = userName + (isLocal ? ' (You)' : '');

    const statusContainer = document.createElement('div');
    statusContainer.className = 'participant-status';

    // Microphone status
    const micStatus = document.createElement('span');
    micStatus.className = `status-icon ${isMuted ? 'muted' : 'active'}`;
    micStatus.dataset.type = 'mic';
    micStatus.textContent = isMuted ? '🔇' : '🎤';

    // Video status
    const videoStatus = document.createElement('span');
    videoStatus.className = `status-icon ${isVideoOff ? 'muted' : 'active'}`;
    videoStatus.dataset.type = 'video';
    videoStatus.textContent = isVideoOff ? '📵' : '📹';

    statusContainer.appendChild(micStatus);
    statusContainer.appendChild(videoStatus);

    overlay.appendChild(nameTag);
    overlay.appendChild(statusContainer);

    videoContainer.appendChild(video);
    videoContainer.appendChild(overlay);

    // Add to container
    this.container.appendChild(videoContainer);

    // Store reference
    this.videos.set(userId, {
      container: videoContainer,
      video: video,
      stream: stream,
      overlay: overlay,
      micStatus: micStatus,
      videoStatus: videoStatus
    });

    // Update layout
    this.updateLayout();

    console.log(`[VideoGrid] Added video for user ${userId}`);
  }

  /**
   * Remove a video from the grid
   * @param {string} userId - User ID
   */
  removeVideo(userId) {
    const videoData = this.videos.get(userId);
    
    if (!videoData) {
      console.warn(`[VideoGrid] Video for user ${userId} not found`);
      return;
    }

    // Stop all tracks
    if (videoData.stream) {
      videoData.stream.getTracks().forEach(track => track.stop());
    }

    // Remove from DOM
    videoData.container.remove();

    // Remove from map
    this.videos.delete(userId);

    // Update layout
    this.updateLayout();

    console.log(`[VideoGrid] Removed video for user ${userId}`);
  }

  /**
   * Update media state for a participant
   * @param {string} userId - User ID
   * @param {object} state - Media state {audio: boolean, video: boolean}
   */
  updateMediaState(userId, state) {
    const videoData = this.videos.get(userId);
    
    if (!videoData) {
      console.warn(`[VideoGrid] Video for user ${userId} not found`);
      return;
    }

    // Update microphone status
    if (state.audio !== undefined) {
      videoData.micStatus.className = `status-icon ${state.audio ? 'active' : 'muted'}`;
      videoData.micStatus.textContent = state.audio ? '🎤' : '🔇';
    }

    // Update video status
    if (state.video !== undefined) {
      videoData.videoStatus.className = `status-icon ${state.video ? 'active' : 'muted'}`;
      videoData.videoStatus.textContent = state.video ? '📹' : '📵';
      
      // Show/hide video element
      videoData.video.style.display = state.video ? 'block' : 'none';
      
      // Add placeholder if video is off
      if (!state.video) {
        this.addVideoPlaceholder(videoData.container);
      } else {
        this.removeVideoPlaceholder(videoData.container);
      }
    }
  }

  /**
   * Add placeholder when video is off
   * @param {HTMLElement} container - Video container
   */
  addVideoPlaceholder(container) {
    let placeholder = container.querySelector('.video-placeholder');
    
    if (!placeholder) {
      placeholder = document.createElement('div');
      placeholder.className = 'video-placeholder';
      placeholder.innerHTML = '<span class="placeholder-icon">👤</span>';
      container.insertBefore(placeholder, container.firstChild);
    }
  }

  /**
   * Remove video placeholder
   * @param {HTMLElement} container - Video container
   */
  removeVideoPlaceholder(container) {
    const placeholder = container.querySelector('.video-placeholder');
    if (placeholder) {
      placeholder.remove();
    }
  }

  
   // Update grid layout based on number of videos
   
  updateLayout() {
    const count = this.videos.size;
    this.layout = this.calculateOptimalLayout(count);

    // Apply CSS grid layout
    this.container.style.gridTemplateColumns = `repeat(${this.layout.cols}, 1fr)`;
    this.container.style.gridTemplateRows = `repeat(${this.layout.rows}, 1fr)`;

    console.log(`[VideoGrid] Layout updated: ${this.layout.rows}x${this.layout.cols} for ${count} participants`);
  }

  /**
   * Calculate optimal grid layout
   * @param {number} count - Number of videos
   * @returns {object} Layout configuration
   */
  calculateOptimalLayout(count) {
    if (count === 0) return { rows: 1, cols: 1 };
    if (count === 1) return { rows: 1, cols: 1 };
    if (count === 2) return { rows: 1, cols: 2 };
    if (count <= 4) return { rows: 2, cols: 2 };
    if (count <= 6) return { rows: 2, cols: 3 };
    if (count <= 9) return { rows: 3, cols: 3 };
    if (count <= 12) return { rows: 3, cols: 4 };
    if (count <= 16) return { rows: 4, cols: 4 };
    
    // For more participants, use more rows
    const cols = 4;
    const rows = Math.ceil(count / cols);
    return { rows, cols };
  }

  /**
   * Highlight a speaking participant
   * @param {string} userId - User ID
   */
  highlightSpeaker(userId) {
    // Remove previous highlights
    this.container.querySelectorAll('.video-container.speaking').forEach(el => {
      el.classList.remove('speaking');
    });

    // Add highlight to current speaker
    const videoData = this.videos.get(userId);
    if (videoData) {
      videoData.container.classList.add('speaking');
    }
  }

  /**
   * Pin a video (make it larger)
   * @param {string} userId - User ID
   */
  pinVideo(userId) {
    const videoData = this.videos.get(userId);
    if (videoData) {
      videoData.container.classList.toggle('pinned');
      this.updateLayout();
    }
  }

  
   // Clear all videos
  clear() {
    this.videos.forEach((_, userId) => {
      this.removeVideo(userId);
    });
  }

  /**
   * Get count of videos
   * @returns {number} Number of videos
   */
  getVideoCount() {
    return this.videos.size;
  }

  /**
   * Get all participant IDs
   * @returns {Array<string>} Array of user IDs
   */
  getParticipantIds() {
    return Array.from(this.videos.keys());
  }

  /**
   * Enable/disable screen share mode
   * @param {boolean} enabled - Enable screen share mode
   */
  setScreenShareMode(enabled) {
    if (enabled) {
      this.container.classList.add('screen-share-mode');
    } else {
      this.container.classList.remove('screen-share-mode');
    }
  }

  // Destroy the video grid
  destroy() {
    this.clear();
    this.container.innerHTML = '';
    this.videos.clear();
  }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = VideoGrid;
}

// Make globally accessible
window.VideoGrid = VideoGrid;