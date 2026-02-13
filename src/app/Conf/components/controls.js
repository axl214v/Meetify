class Controls {
  constructor(options = {}) {
    this.options = {
      micButtonId: options.micButtonId || 'toggleMic',
      videoButtonId: options.videoButtonId || 'toggleVideo',
      screenButtonId: options.screenButtonId || 'toggleScreen',
      participantsButtonId: options.participantsButtonId || 'toggleParticipants',
      chatButtonId: options.chatButtonId || 'toggleChat',
      leaveButtonId: options.leaveButtonId || 'leaveBtn',
      settingsButtonId: options.settingsButtonId || 'toggleSettings'
    };

    // State
    this.state = {
      isMicEnabled: true,
      isVideoEnabled: true,
      isScreenSharing: false,
      isChatOpen: false,
      isParticipantsOpen: false,
      isSettingsOpen: false
    };

    // Callbacks
    this.callbacks = {
      onMicToggle: null,
      onVideoToggle: null,
      onScreenToggle: null,
      onParticipantsToggle: null,
      onChatToggle: null,
      onSettingsToggle: null,
      onLeave: null
    };

    // Get button elements
    this.buttons = this.getButtons();

    this.init();
  }
 
   // Get all button elements   
  getButtons() {
    return {
      mic: document.getElementById(this.options.micButtonId),
      video: document.getElementById(this.options.videoButtonId),
      screen: document.getElementById(this.options.screenButtonId),
      participants: document.getElementById(this.options.participantsButtonId),
      chat: document.getElementById(this.options.chatButtonId),
      leave: document.getElementById(this.options.leaveButtonId),
      settings: document.getElementById(this.options.settingsButtonId)
    };
  }

   // Initialize controls
  init() {
    // Setup event listeners
    this.setupEventListeners();
    
    // Update initial UI state
    this.updateUI();

    console.log('[Controls] Initialized');
  }

   // Setup event listeners for all buttons
  setupEventListeners() {
    // Microphone toggle
    if (this.buttons.mic) {
      this.buttons.mic.addEventListener('click', () => {
        this.toggleMic();
      });
    }

    // Video toggle
    if (this.buttons.video) {
      this.buttons.video.addEventListener('click', () => {
        this.toggleVideo();
      });
    }

    // Screen share toggle
    if (this.buttons.screen) {
      this.buttons.screen.addEventListener('click', () => {
        this.toggleScreen();
      });
    }

    // Participants toggle
    if (this.buttons.participants) {
      this.buttons.participants.addEventListener('click', () => {
        this.toggleParticipants();
      });
    }

    // Chat toggle
    if (this.buttons.chat) {
      this.buttons.chat.addEventListener('click', () => {
        this.toggleChat();
      });
    }

    // Settings toggle
    if (this.buttons.settings) {
      this.buttons.settings.addEventListener('click', () => {
        this.toggleSettings();
      });
    }

    // Leave conference
    if (this.buttons.leave) {
      this.buttons.leave.addEventListener('click', () => {
        this.leave();
      });
    }

    // Keyboard shortcuts
    document.addEventListener('keydown', (e) => {
      this.handleKeyboardShortcut(e);
    });
  }

   // Toggle microphone
  toggleMic() {
    this.state.isMicEnabled = !this.state.isMicEnabled;
    this.updateUI();

    if (this.callbacks.onMicToggle) {
      this.callbacks.onMicToggle(this.state.isMicEnabled);
    }

    console.log(`[Controls] Mic ${this.state.isMicEnabled ? 'enabled' : 'disabled'}`);
  }

   // Toggle camera
  toggleVideo() {
    this.state.isVideoEnabled = !this.state.isVideoEnabled;
    this.updateUI();

    if (this.callbacks.onVideoToggle) {
      this.callbacks.onVideoToggle(this.state.isVideoEnabled);
    }

    console.log(`[Controls] Video ${this.state.isVideoEnabled ? 'enabled' : 'disabled'}`);
  }


   // Toggle screen sharing
  toggleScreen() {
    this.state.isScreenSharing = !this.state.isScreenSharing;
    this.updateUI();

    if (this.callbacks.onScreenToggle) {
      this.callbacks.onScreenToggle(this.state.isScreenSharing);
    }

    console.log(`[Controls] Screen sharing ${this.state.isScreenSharing ? 'started' : 'stopped'}`);
  }

   // Toggle participants sidebar
  toggleParticipants() {
    this.state.isParticipantsOpen = !this.state.isParticipantsOpen;
    this.updateUI();

    if (this.callbacks.onParticipantsToggle) {
      this.callbacks.onParticipantsToggle(this.state.isParticipantsOpen);
    }
  }

   // Toggle chat sidebar
  toggleChat() {
    this.state.isChatOpen = !this.state.isChatOpen;
    this.updateUI();

    if (this.callbacks.onChatToggle) {
      this.callbacks.onChatToggle(this.state.isChatOpen);
    }
  }


   // Toggle settings
  toggleSettings() {
    this.state.isSettingsOpen = !this.state.isSettingsOpen;
    this.updateUI();

    if (this.callbacks.onSettingsToggle) {
      this.callbacks.onSettingsToggle(this.state.isSettingsOpen);
    }
  }

   // Leave conference
  leave() {
    if (confirm('Are you sure you want to leave this conference?')) {
      if (this.callbacks.onLeave) {
        this.callbacks.onLeave();
      }
    }
  }

   // Update UI based on current state
  updateUI() {
    // Update mic button
    if (this.buttons.mic) {
      if (this.state.isMicEnabled) {
        this.buttons.mic.classList.remove('muted');
        this.buttons.mic.innerHTML = '🎤';
        this.buttons.mic.title = 'Mute microphone';
      } else {
        this.buttons.mic.classList.add('muted');
        this.buttons.mic.innerHTML = '🔇';
        this.buttons.mic.title = 'Unmute microphone';
      }
    }

    // Update video button
    if (this.buttons.video) {
      if (this.state.isVideoEnabled) {
        this.buttons.video.classList.remove('off');
        this.buttons.video.innerHTML = '📹';
        this.buttons.video.title = 'Turn off camera';
      } else {
        this.buttons.video.classList.add('off');
        this.buttons.video.innerHTML = '📵';
        this.buttons.video.title = 'Turn on camera';
      }
    }

    // Update screen share button
    if (this.buttons.screen) {
      if (this.state.isScreenSharing) {
        this.buttons.screen.classList.add('sharing');
        this.buttons.screen.innerHTML = '⏹️';
        this.buttons.screen.title = 'Stop sharing';
      } else {
        this.buttons.screen.classList.remove('sharing');
        this.buttons.screen.innerHTML = '🖥️';
        this.buttons.screen.title = 'Share screen';
      }
    }

    // Update participants button
    if (this.buttons.participants) {
      if (this.state.isParticipantsOpen) {
        this.buttons.participants.classList.add('active');
      } else {
        this.buttons.participants.classList.remove('active');
      }
    }

    // Update chat button
    if (this.buttons.chat) {
      if (this.state.isChatOpen) {
        this.buttons.chat.classList.add('active');
      } else {
        this.buttons.chat.classList.remove('active');
      }
    }

    // Update settings button
    if (this.buttons.settings) {
      if (this.state.isSettingsOpen) {
        this.buttons.settings.classList.add('active');
      } else {
        this.buttons.settings.classList.remove('active');
      }
    }
  }

  /**
   * Handle keyboard shortcuts
   * @param {KeyboardEvent} e - Keyboard event
   */
  handleKeyboardShortcut(e) {
    // Don't trigger if user is typing in an input
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') {
      return;
    }

    // Ctrl/Cmd + D: Toggle mic
    if ((e.ctrlKey || e.metaKey) && e.key === 'd') {
      e.preventDefault();
      this.toggleMic();
    }

    // Ctrl/Cmd + E: Toggle video
    if ((e.ctrlKey || e.metaKey) && e.key === 'e') {
      e.preventDefault();
      this.toggleVideo();
    }

    // Ctrl/Cmd + Shift + E: Toggle screen share
    if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'E') {
      e.preventDefault();
      this.toggleScreen();
    }

    // Ctrl/Cmd + Shift + P: Toggle participants
    if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'P') {
      e.preventDefault();
      this.toggleParticipants();
    }

    // Ctrl/Cmd + Shift + C: Toggle chat
    if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'C') {
      e.preventDefault();
      this.toggleChat();
    }
  }

  /**
   * Set callback functions
   */
  on(event, callback) {
    switch(event) {
      case 'micToggle':
        this.callbacks.onMicToggle = callback;
        break;
      case 'videoToggle':
        this.callbacks.onVideoToggle = callback;
        break;
      case 'screenToggle':
        this.callbacks.onScreenToggle = callback;
        break;
      case 'participantsToggle':
        this.callbacks.onParticipantsToggle = callback;
        break;
      case 'chatToggle':
        this.callbacks.onChatToggle = callback;
        break;
      case 'settingsToggle':
        this.callbacks.onSettingsToggle = callback;
        break;
      case 'leave':
        this.callbacks.onLeave = callback;
        break;
    }
  }

  /**
   * Set mic state programmatically
   * @param {boolean} enabled - Enable/disable mic
   */
  setMicState(enabled) {
    this.state.isMicEnabled = enabled;
    this.updateUI();
  }

  /**
   * Set video state programmatically
   * @param {boolean} enabled - Enable/disable video
   */
  setVideoState(enabled) {
    this.state.isVideoEnabled = enabled;
    this.updateUI();
  }

  /**
   * Set screen share state programmatically
   * @param {boolean} sharing - Sharing state
   */
  setScreenShareState(sharing) {
    this.state.isScreenSharing = sharing;
    this.updateUI();
  }

  /**
   * Update chat badge count
   * @param {number} count - Unread count
   */
  updateChatBadge(count) {
    if (!this.buttons.chat) return;

    let badge = this.buttons.chat.querySelector('.notification-badge');
    
    if (!badge && count > 0) {
      badge = document.createElement('span');
      badge.className = 'notification-badge';
      this.buttons.chat.appendChild(badge);
    }

    if (badge) {
      if (count > 0) {
        badge.textContent = count > 99 ? '99+' : count;
        badge.style.display = 'flex';
      } else {
        badge.style.display = 'none';
      }
    }
  }

  /**
   * Enable/disable button
   * @param {string} buttonName - Button name
   * @param {boolean} enabled - Enable/disable
   */
  setButtonEnabled(buttonName, enabled) {
    const button = this.buttons[buttonName];
    if (button) {
      button.disabled = !enabled;
      if (!enabled) {
        button.classList.add('disabled');
      } else {
        button.classList.remove('disabled');
      }
    }
  }

  /**
   * Show loading state on button
   * @param {string} buttonName - Button name
   * @param {boolean} loading - Loading state
   */
  setButtonLoading(buttonName, loading) {
    const button = this.buttons[buttonName];
    if (button) {
      if (loading) {
        button.classList.add('loading');
        button.disabled = true;
      } else {
        button.classList.remove('loading');
        button.disabled = false;
      }
    }
  }

  /**
   * Get current state
   * @returns {object} Current state
   */
  getState() {
    return { ...this.state };
  }

   // Destroy controls
  destroy() {
    // Remove event listeners
    Object.values(this.buttons).forEach(button => {
      if (button) {
        const newButton = button.cloneNode(true);
        button.parentNode.replaceChild(newButton, button);
      }
    });

    this.callbacks = {};
  }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = Controls;
}

// Make globally accessible
window.Controls = Controls;