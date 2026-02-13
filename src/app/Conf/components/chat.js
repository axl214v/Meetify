class Chat {
  constructor(containerId, inputId, sendButtonId) {
    this.messagesContainer = document.getElementById(containerId);
    this.inputElement = document.getElementById(inputId);
    this.sendButton = document.getElementById(sendButtonId);
    
    this.messages = [];
    this.currentUser = null;
    this.onSendCallback = null;
    this.unreadCount = 0;
    this.isVisible = false;
    
    if (!this.messagesContainer || !this.inputElement || !this.sendButton) {
      throw new Error('Chat: Required elements not found');
    }
    
    this.init();
  }

    // Initialize chat component
  init() {
    // Setup event listeners
    this.sendButton.addEventListener('click', () => this.sendMessage());
    
    this.inputElement.addEventListener('keypress', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        this.sendMessage();
      }
    });

    // Auto-resize textarea
    this.inputElement.addEventListener('input', () => {
      this.inputElement.style.height = 'auto';
      this.inputElement.style.height = this.inputElement.scrollHeight + 'px';
    });

    console.log('[Chat] Initialized');
  }

  /**
   * Set current user info
   * @param {object} user - User object {userId, userName}
   */
  setCurrentUser(user) {
    this.currentUser = user;
  }

  /**
   * Set callback for sending messages
   * @param {Function} callback - Callback function
   */
  onSend(callback) {
    this.onSendCallback = callback;
  }

  /**
   * Send a message
   */
  sendMessage() {
    const message = this.inputElement.value.trim();
    
    if (!message) {
      return;
    }

    if (!this.currentUser) {
      console.error('[Chat] Current user not set');
      return;
    }

    const messageData = {
      message,
      userId: this.currentUser.userId,
      userName: this.currentUser.userName,
      timestamp: new Date().toISOString()
    };

    // Call the send callback
    if (this.onSendCallback) {
      this.onSendCallback(messageData);
    }

    // Add to local messages (will be confirmed when received from server)
    // this.addMessage(messageData, true);

    // Clear input
    this.inputElement.value = '';
    this.inputElement.style.height = 'auto';
  }

  /**
   * Add a message to the chat
   * @param {object} messageData - Message data
   * @param {boolean} isOwn - Is this message from current user
   */
  addMessage(messageData, isOwn = false) {
    const { message, userName, timestamp } = messageData;

    // Create message element
    const messageEl = document.createElement('div');
    messageEl.className = `chat-message ${isOwn ? 'own' : ''}`;

    // Format timestamp
    const time = timestamp ? this.formatTime(timestamp) : '';

    messageEl.innerHTML = `
      <div class="message-header">
        <strong class="message-sender">${this.escapeHtml(userName)}</strong>
        <span class="message-time">${time}</span>
      </div>
      <p class="message-content">${this.escapeHtml(message)}</p>
    `;

    // Add to container
    this.messagesContainer.appendChild(messageEl);

    // Store in messages array
    this.messages.push({
      ...messageData,
      isOwn,
      element: messageEl
    });

    // Scroll to bottom
    this.scrollToBottom();

    // Update unread count if chat is not visible
    if (!this.isVisible) {
      this.unreadCount++;
    }

    console.log(`[Chat] Message added from ${userName}`);
  }

  /**
   * Add a system message
   * @param {string} message - System message text
   */
  addSystemMessage(message) {
    const messageEl = document.createElement('div');
    messageEl.className = 'chat-message system';
    messageEl.innerHTML = `<p class="message-content">${this.escapeHtml(message)}</p>`;

    this.messagesContainer.appendChild(messageEl);
    this.scrollToBottom();
  }

  /**
   * Format timestamp
   * @param {string} timestamp - ISO timestamp
   * @returns {string} Formatted time
   */
  formatTime(timestamp) {
    const date = new Date(timestamp);
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    return `${hours}:${minutes}`;
  }

  /**
   * Escape HTML to prevent XSS
   * @param {string} text - Text to escape
   * @returns {string} Escaped text
   */
  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

    // Scroll chat to bottom
  scrollToBottom() {
    this.messagesContainer.scrollTop = this.messagesContainer.scrollHeight;
  }

  
   // Clear all messages
  clear() {
    this.messagesContainer.innerHTML = '';
    this.messages = [];
  }

  /**
   * Set chat visibility
   * @param {boolean} visible - Is visible
   */
  setVisibility(visible) {
    this.isVisible = visible;
    
    if (visible) {
      this.unreadCount = 0;
      this.scrollToBottom();
    }
  }

  /**
   * Get unread count
   * @returns {number} Unread count
   */
  getUnreadCount() {
    return this.unreadCount;
  }

  
   // Reset unread count
  resetUnreadCount() {
    this.unreadCount = 0;
  }

  /**
   * Get all messages
   * @returns {Array} Messages array
   */
  getMessages() {
    return this.messages;
  }

  /**
   * Export chat history
   * @returns {string} Chat history as text
   */
  exportHistory() {
    return this.messages.map(msg => {
      const time = this.formatTime(msg.timestamp);
      return `[${time}] ${msg.userName}: ${msg.message}`;
    }).join('\n');
  }

  /**
   * Search messages
   * @param {string} query - Search query
   * @returns {Array} Matching messages
   */
  searchMessages(query) {
    const lowerQuery = query.toLowerCase();
    return this.messages.filter(msg => 
      msg.message.toLowerCase().includes(lowerQuery) ||
      msg.userName.toLowerCase().includes(lowerQuery)
    );
  }

  /**
   * Highlight search results
   * @param {string} query - Search query
   */
  highlightSearch(query) {
    if (!query) {
      // Clear highlights
      this.messages.forEach(msg => {
        msg.element.classList.remove('highlight');
      });
      return;
    }

    const results = this.searchMessages(query);
    
    // Remove all highlights
    this.messages.forEach(msg => {
      msg.element.classList.remove('highlight');
    });

    // Add highlights to results
    results.forEach(msg => {
      msg.element.classList.add('highlight');
    });
  }

  /**
   * Add emoji to message input
   * @param {string} emoji - Emoji to add
   */
  addEmoji(emoji) {
    const cursorPos = this.inputElement.selectionStart;
    const textBefore = this.inputElement.value.substring(0, cursorPos);
    const textAfter = this.inputElement.value.substring(cursorPos);
    
    this.inputElement.value = textBefore + emoji + textAfter;
    this.inputElement.focus();
    
    // Set cursor position after emoji
    this.inputElement.selectionStart = cursorPos + emoji.length;
    this.inputElement.selectionEnd = cursorPos + emoji.length;
  }

  /**
   * Enable/disable chat
   * @param {boolean} enabled - Enable chat
   */
  setEnabled(enabled) {
    this.inputElement.disabled = !enabled;
    this.sendButton.disabled = !enabled;
    
    if (!enabled) {
      this.inputElement.placeholder = 'Chat is disabled';
    } else {
      this.inputElement.placeholder = 'Type a message...';
    }
  }

  
   // Destroy chat component
  destroy() {
    this.clear();
    this.inputElement.value = '';
    this.onSendCallback = null;
  }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = Chat;
}

// Make globally accessible
window.Chat = Chat;