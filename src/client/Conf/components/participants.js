class Participants {
  constructor(containerId, options = {}) {
    this.container = document.getElementById(containerId);
    this.options = {
      showHost: options.showHost !== false,
      showMediaStatus: options.showMediaStatus !== false,
      allowKick: options.allowKick || false,
      ...options
    };

    this.participants = new Map(); // userId -> participant data
    this.currentUserId = null;
    this.hostId = null;

    // Callbacks
    this.callbacks = {
      onKick: null,
      onMute: null,
      onPin: null
    };

    if (!this.container) {
      throw new Error(`Participants: Container with id "${containerId}" not found`);
    }

    this.init();
  }

  
   // Initialize participants list
  init() {
    this.container.classList.add('participants-container');
    this.render();
    console.log('[Participants] Initialized');
  }

  /**
   * Set current user ID
   * @param {string} userId - Current user ID
   */
  setCurrentUser(userId) {
    this.currentUserId = userId;
  }

  /**
   * Set host ID
   * @param {string} userId - Host user ID
   */
  setHost(userId) {
    this.hostId = userId;
    this.render();
  }

  /**
   * Add a participant
   * @param {object} participant - Participant data
   */
  addParticipant(participant) {
    const {
      userId,
      userName,
      isHost = false,
      audio = true,
      video = true,
      joinedAt = new Date().toISOString()
    } = participant;

    this.participants.set(userId, {
      userId,
      userName,
      isHost,
      audio,
      video,
      joinedAt,
      isPinned: false,
      isHandRaised: false
    });

    if (isHost) {
      this.hostId = userId;
    }

    this.render();
    console.log(`[Participants] Added: ${userName} (${userId})`);
  }

  /**
   * Remove a participant
   * @param {string} userId - User ID
   */
  removeParticipant(userId) {
    const participant = this.participants.get(userId);
    
    if (participant) {
      this.participants.delete(userId);
      this.render();
      console.log(`[Participants] Removed: ${participant.userName} (${userId})`);
    }
  }

  /**
   * Update participant media state
   * @param {string} userId - User ID
   * @param {object} state - Media state {audio, video}
   */
  updateMediaState(userId, state) {
    const participant = this.participants.get(userId);
    
    if (participant) {
      if (state.audio !== undefined) {
        participant.audio = state.audio;
      }
      if (state.video !== undefined) {
        participant.video = state.video;
      }
      
      this.renderParticipant(userId);
    }
  }

  /**
   * Toggle hand raised state
   * @param {string} userId - User ID
   */
  toggleHandRaised(userId) {
    const participant = this.participants.get(userId);
    
    if (participant) {
      participant.isHandRaised = !participant.isHandRaised;
      this.renderParticipant(userId);
    }
  }

  /**
   * Pin a participant
   * @param {string} userId - User ID
   */
  pinParticipant(userId) {
    // Unpin all others
    this.participants.forEach((p, id) => {
      p.isPinned = (id === userId);
    });
    
    this.render();
  }

   // Render the entire participants list
  render() {
    // Clear container
    this.container.innerHTML = '';

    if (this.participants.size === 0) {
      this.container.innerHTML = '<p class="no-participants">No participants yet</p>';
      return;
    }

    // Sort participants: host first, then by join time
    const sorted = Array.from(this.participants.values()).sort((a, b) => {
      if (a.isHost && !b.isHost) return -1;
      if (!a.isHost && b.isHost) return 1;
      return new Date(a.joinedAt) - new Date(b.joinedAt);
    });

    // Render each participant
    sorted.forEach(participant => {
      const element = this.createParticipantElement(participant);
      this.container.appendChild(element);
    });

    // Update count
    this.updateCount();
  }

  /**
   * Render a single participant (update existing)
   * @param {string} userId - User ID
   */
  renderParticipant(userId) {
    const participant = this.participants.get(userId);
    if (!participant) return;

    const existingElement = document.getElementById(`participant-${userId}`);
    if (existingElement) {
      const newElement = this.createParticipantElement(participant);
      existingElement.replaceWith(newElement);
    } else {
      this.render();
    }
  }

  /**
   * Create participant element
   * @param {object} participant - Participant data
   * @returns {HTMLElement} Participant element
   */
  createParticipantElement(participant) {
    const { userId, userName, isHost, audio, video, isPinned, isHandRaised } = participant;
    const isCurrentUser = userId === this.currentUserId;
    const canKick = this.options.allowKick && this.currentUserId === this.hostId && !isHost && !isCurrentUser;

    const item = document.createElement('div');
    item.id = `participant-${userId}`;
    item.className = `participant-item ${isPinned ? 'pinned' : ''} ${isCurrentUser ? 'current-user' : ''}`;
    item.dataset.userId = userId;

    // Avatar
    const avatar = document.createElement('div');
    avatar.className = 'participant-avatar';
    avatar.style.background = this.stringToColor(userName);
    avatar.textContent = this.getInitials(userName);

    // Info container
    const info = document.createElement('div');
    info.className = 'participant-info';

    const nameContainer = document.createElement('div');
    nameContainer.className = 'participant-name-container';

    const name = document.createElement('strong');
    name.textContent = userName + (isCurrentUser ? ' (You)' : '');

    // Badges
    const badges = document.createElement('span');
    badges.className = 'participant-badges';
    
    if (isHost) {
      const hostBadge = document.createElement('span');
      hostBadge.className = 'badge host-badge';
      hostBadge.textContent = '👑';
      hostBadge.title = 'Host';
      badges.appendChild(hostBadge);
    }

    if (isHandRaised) {
      const handBadge = document.createElement('span');
      handBadge.className = 'badge hand-badge';
      handBadge.textContent = '✋';
      handBadge.title = 'Hand raised';
      badges.appendChild(handBadge);
    }

    nameContainer.appendChild(name);
    if (badges.children.length > 0) {
      nameContainer.appendChild(badges);
    }

    // Media status
    const status = document.createElement('small');
    status.className = 'participant-status';
    
    const micIcon = audio ? '🎤' : '🔇';
    const videoIcon = video ? '📹' : '📵';
    status.innerHTML = `<span class="${audio ? 'active' : 'muted'}">${micIcon}</span> <span class="${video ? 'active' : 'muted'}">${videoIcon}</span>`;

    info.appendChild(nameContainer);
    if (this.options.showMediaStatus) {
      info.appendChild(status);
    }

    // Actions menu
    const actions = document.createElement('div');
    actions.className = 'participant-actions';

    // More menu button
    if (!isCurrentUser) {
      const menuBtn = document.createElement('button');
      menuBtn.className = 'action-btn menu-btn';
      menuBtn.innerHTML = '⋮';
      menuBtn.title = 'More actions';
      menuBtn.onclick = (e) => {
        e.stopPropagation();
        this.showActionsMenu(userId, menuBtn);
      };
      actions.appendChild(menuBtn);
    }

    // Kick button (host only)
    if (canKick) {
      const kickBtn = document.createElement('button');
      kickBtn.className = 'action-btn kick-btn';
      kickBtn.innerHTML = '❌';
      kickBtn.title = 'Remove participant';
      kickBtn.onclick = (e) => {
        e.stopPropagation();
        this.kickParticipant(userId);
      };
      actions.appendChild(kickBtn);
    }

    // Assemble
    item.appendChild(avatar);
    item.appendChild(info);
    if (actions.children.length > 0) {
      item.appendChild(actions);
    }

    // Click to pin/unpin
    item.onclick = () => {
      this.pinParticipant(isPinned ? null : userId);
      if (this.callbacks.onPin) {
        this.callbacks.onPin(isPinned ? null : userId);
      }
    };

    return item;
  }

  /**
   * Show actions menu for participant
   * @param {string} userId - User ID
   * @param {HTMLElement} button - Button element
   */
  showActionsMenu(userId, button) {
    // Close existing menus
    document.querySelectorAll('.participant-menu').forEach(menu => menu.remove());

    const participant = this.participants.get(userId);
    if (!participant) return;

    const menu = document.createElement('div');
    menu.className = 'participant-menu';

    const actions = [
      {
        label: participant.isPinned ? 'Unpin' : 'Pin',
        icon: '📌',
        action: () => {
          this.pinParticipant(participant.isPinned ? null : userId);
          if (this.callbacks.onPin) {
            this.callbacks.onPin(participant.isPinned ? null : userId);
          }
        }
      }
    ];

    // Host-only actions
    if (this.currentUserId === this.hostId && !participant.isHost) {
      actions.push({
        label: 'Mute',
        icon: '🔇',
        action: () => {
          if (this.callbacks.onMute) {
            this.callbacks.onMute(userId);
          }
        }
      });
    }

    actions.forEach(({ label, icon, action }) => {
      const item = document.createElement('div');
      item.className = 'menu-item';
      item.innerHTML = `${icon} ${label}`;
      item.onclick = () => {
        action();
        menu.remove();
      };
      menu.appendChild(item);
    });

    // Position menu
    const rect = button.getBoundingClientRect();
    menu.style.position = 'absolute';
    menu.style.top = `${rect.bottom + 5}px`;
    menu.style.right = `${window.innerWidth - rect.right}px`;

    document.body.appendChild(menu);

    // Close on click outside
    setTimeout(() => {
      document.addEventListener('click', function closeMenu() {
        menu.remove();
        document.removeEventListener('click', closeMenu);
      });
    }, 100);
  }

  /**
   * Kick a participant (host only)
   * @param {string} userId - User ID
   */
  kickParticipant(userId) {
    const participant = this.participants.get(userId);
    
    if (confirm(`Remove ${participant.userName} from the conference?`)) {
      if (this.callbacks.onKick) {
        this.callbacks.onKick(userId);
      }
      this.removeParticipant(userId);
    }
  }

   // Update participant count
  updateCount() {
    const countElement = document.getElementById('participantCount');
    if (countElement) {
      countElement.textContent = this.participants.size;
    }
  }

  /**
   * Get participant count
   * @returns {number} Participant count
   */
  getCount() {
    return this.participants.size;
  }

  /**
   * Get all participants
   * @returns {Array} Array of participants
   */
  getAll() {
    return Array.from(this.participants.values());
  }

  /**
   * Get participant by ID
   * @param {string} userId - User ID
   * @returns {object|null} Participant data
   */
  getParticipant(userId) {
    return this.participants.get(userId) || null;
  }

   // Clear all participants
  clear() {
    this.participants.clear();
    this.render();
  }

   // Set callback functions
  on(event, callback) {
    switch(event) {
      case 'kick':
        this.callbacks.onKick = callback;
        break;
      case 'mute':
        this.callbacks.onMute = callback;
        break;
      case 'pin':
        this.callbacks.onPin = callback;
        break;
    }
  }

  /**
   * Generate color from string
   * @param {string} str - String
   * @returns {string} Color
   */
  stringToColor(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      hash = str.charCodeAt(i) + ((hash << 5) - hash);
    }
    
    const colors = [
      '#667eea', '#764ba2', '#f093fb', '#4facfe',
      '#43e97b', '#fa709a', '#fee140', '#30cfd0',
      '#a8edea', '#fed6e3', '#c471f5', '#12c2e9'
    ];
    
    return colors[Math.abs(hash) % colors.length];
  }

  /**
   * Get initials from name
   * @param {string} name - Name
   * @returns {string} Initials
   */
  getInitials(name) {
    const parts = name.trim().split(/\s+/);
    if (parts.length === 1) {
      return parts[0].substring(0, 2).toUpperCase();
    }
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  }

   // Destroy component
  destroy() {
    this.clear();
    this.callbacks = {};
  }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = Participants;
}

// Make globally accessible
window.Participants = Participants;