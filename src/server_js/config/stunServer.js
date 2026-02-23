/**
 * STUN/TURN Server Configuration
 * 
 * This file contains configuration for your own STUN/TURN server
 * For production, you should set up your own TURN server using CoTURN
 */

// ============================================
// STUN/TURN Server Settings
// ============================================

/**
 * CoTURN Server Configuration
 * Install CoTURN: sudo apt-get install coturn
 * Config file usually at: /etc/turnserver.conf
 */

const stunTurnConfig = {
  // Use your own server or third-party service
  useOwnServer: process.env.USE_OWN_STUN_SERVER === 'true' || false,
  
  // Public STUN servers (free, but limited)
  publicStunServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun2.l.google.com:19302' },
    { urls: 'stun:stun3.l.google.com:19302' },
    { urls: 'stun:stun4.l.google.com:19302' },
    { urls: 'stun:stun.services.mozilla.com' },
  ],
  
  // Your own STUN server
  ownStunServer: {
    urls: process.env.STUN_SERVER_URL || 'stun:your-server.com:3478',
    // STUN typically doesn't need credentials
  },
  
  // Your own TURN server (required for NAT traversal)
  ownTurnServer: [
    {
      urls: process.env.TURN_SERVER_URL || 'turn:your-server.com:3478',
      username: process.env.TURN_USERNAME || 'meetify_user',
      credential: process.env.TURN_PASSWORD || 'axYz12345SecureSecretKey',
      credentialType: 'password'
    },
    {
      // TURN over TLS (more secure)
      urls: process.env.TURNS_SERVER_URL || 'turns:your-server.com:5349',
      username: process.env.TURN_USERNAME || 'meetify_user',
      credential: process.env.TURN_PASSWORD || 'axYz12345SecureSecretKey',
      credentialType: 'password'
    }
  ],
  
  // Third-party TURN services (paid)
  thirdPartyServices: {
    // Twilio
    twilio: {
      enabled: process.env.TWILIO_ENABLED === 'true' || false,
      accountSid: process.env.TWILIO_ACCOUNT_SID || '',
      authToken: process.env.TWILIO_AUTH_TOKEN || '',
      // Twilio provides ICE servers dynamically via API
    },
    
    // Xirsys
    xirsys: {
      enabled: process.env.XIRSYS_ENABLED === 'true' || false,
      ident: process.env.XIRSYS_IDENT || '',
      secret: process.env.XIRSYS_SECRET || '',
      channel: process.env.XIRSYS_CHANNEL || 'meetify',
      // Xirsys provides ICE servers dynamically via API
    }
  }
};

// ============================================
// CoTURN Example Configuration
// ============================================

/**
 * Example /etc/turnserver.conf for CoTURN:
 * 
 * # Listener IP and ports
 * listening-ip=0.0.0.0
 * listening-port=3478
 * tls-listening-port=5349
 * 
 * # External IP (your server's public IP)
 * external-ip=YOUR_PUBLIC_IP
 * 
 * # Authentication
 * lt-cred-mech
 * user=meetify_user:your_secret_password
 * 
 * # Realm (your domain)
 * realm=your-server.com
 * 
 * # SSL/TLS certificates
 * cert=/etc/letsencrypt/live/your-server.com/cert.pem
 * pkey=/etc/letsencrypt/live/your-server.com/privkey.pem
 * 
 * # Logging
 * log-file=/var/log/turnserver.log
 * verbose
 * 
 * # Security
 * fingerprint
 * no-multicast-peers
 * no-cli
 * no-loopback-peers
 * no-tlsv1
 * no-tlsv1_1
 * 
 * # Limits
 * max-bps=3000000
 * bps-capacity=0
 * stale-nonce=600
 */

// ============================================
// Get ICE Servers Configuration
// ============================================

/**
 * Get ICE servers based on configuration
 * @returns {Array} Array of ICE server configurations
 */
function getIceServers() {
  const iceServers = [];
  
  if (stunTurnConfig.useOwnServer) {
    // Use your own STUN server
    iceServers.push(stunTurnConfig.ownStunServer);
    
    // Add your own TURN servers
    if (stunTurnConfig.ownTurnServer && stunTurnConfig.ownTurnServer.length > 0) {
      iceServers.push(...stunTurnConfig.ownTurnServer);
    }
  } else {
    // Use public STUN servers (no TURN)
    iceServers.push(...stunTurnConfig.publicStunServers);
  }
  
  return iceServers;
}

/**
 * Get ICE servers from Twilio (dynamic)
 * @returns {Promise<Array>} ICE servers
 */
async function getTwilioIceServers() {
  if (!stunTurnConfig.thirdPartyServices.twilio.enabled) {
    return [];
  }
  
  try {
    const twilio = require('twilio');
    const client = twilio(
      stunTurnConfig.thirdPartyServices.twilio.accountSid,
      stunTurnConfig.thirdPartyServices.twilio.authToken
    );
    
    const token = await client.tokens.create();
    return token.iceServers;
  } catch (error) {
    console.error('Error getting Twilio ICE servers:', error);
    return [];
  }
}

/**
 * Get ICE servers from Xirsys (dynamic)
 * @returns {Promise<Array>} ICE servers
 */
async function getXirsysIceServers() {
  if (!stunTurnConfig.thirdPartyServices.xirsys.enabled) {
    return [];
  }
  
  try {
    const fetch = require('node-fetch');
    const { ident, secret, channel } = stunTurnConfig.thirdPartyServices.xirsys;
    
    const response = await fetch('https://global.xirsys.net/_turn', {
      method: 'PUT',
      headers: {
        'Authorization': 'Basic ' + Buffer.from(`${ident}:${secret}`).toString('base64'),
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        format: 'urls',
        channel: channel
      })
    });
    
    const data = await response.json();
    
    if (data.s === 'ok' && data.v && data.v.iceServers) {
      return data.v.iceServers;
    }
    
    return [];
  } catch (error) {
    console.error('Error getting Xirsys ICE servers:', error);
    return [];
  }
}

/**
 * Get all available ICE servers (static + dynamic)
 * @returns {Promise<Array>} Combined ICE servers
 */
async function getAllIceServers() {
  const staticServers = getIceServers();
  
  // Get dynamic servers from third-party services
  const twilioServers = await getTwilioIceServers();
  const xirsysServers = await getXirsysIceServers();
  
  return [
    ...staticServers,
    ...twilioServers,
    ...xirsysServers
  ];
}

// ============================================
// TURN Server Statistics
// ============================================

/**
 * Get TURN server statistics (if available)
 * @returns {Object} Server statistics
 */
function getTurnServerStats() {
  return {
    configured: stunTurnConfig.useOwnServer,
    stunUrl: stunTurnConfig.ownStunServer.urls,
    turnUrls: stunTurnConfig.ownTurnServer.map(server => server.urls),
    username: stunTurnConfig.ownTurnServer[0]?.username || 'Not configured',
    status: stunTurnConfig.useOwnServer ? 'active' : 'using public servers'
  };
}

// ============================================
// TURN Server Health Check
// ============================================

/**
 * Check if TURN server is reachable
 * @returns {Promise<boolean>} Server is reachable
 */
async function checkTurnServerHealth() {
  if (!stunTurnConfig.useOwnServer) {
    return true; // Public servers assumed working
  }
  
  try {
    // Simple UDP check (requires dgram module)
    const dgram = require('dgram');
    const client = dgram.createSocket('udp4');
    
    return new Promise((resolve) => {
      const timeout = setTimeout(() => {
        client.close();
        resolve(false);
      }, 5000);
      
      client.on('message', () => {
        clearTimeout(timeout);
        client.close();
        resolve(true);
      });
      
      client.on('error', () => {
        clearTimeout(timeout);
        client.close();
        resolve(false);
      });
      
      // Send a simple STUN binding request
      const message = Buffer.from([0x00, 0x01, 0x00, 0x00]); // Simplified
      const url = new URL(stunTurnConfig.ownStunServer.urls);
      const port = parseInt(url.port) || 3478;
      const host = url.hostname;
      
      client.send(message, port, host);
    });
  } catch (error) {
    console.error('TURN server health check error:', error);
    return false;
  }
}

// ============================================
// Installation Guide
// ============================================

const installationGuide = `
═══════════════════════════════════════════════════════════
  CoTURN Installation Guide (Ubuntu/Debian)
═══════════════════════════════════════════════════════════

1. Install CoTURN:
   sudo apt-get update
   sudo apt-get install coturn

2. Enable CoTURN service:
   sudo systemctl enable coturn

3. Edit configuration:
   sudo nano /etc/turnserver.conf
   
   Add these lines:
   ───────────────────────────────────────────────────────
   listening-ip=0.0.0.0
   listening-port=3478
   tls-listening-port=5349
   external-ip=YOUR_PUBLIC_IP
   
   lt-cred-mech
   user=meetify_user:your_secret_password
   realm=your-server.com
   
   cert=/etc/letsencrypt/live/your-server.com/cert.pem
   pkey=/etc/letsencrypt/live/your-server.com/privkey.pem
   
   fingerprint
   log-file=/var/log/turnserver.log
   ───────────────────────────────────────────────────────

4. Open firewall ports:
   sudo ufw allow 3478/tcp
   sudo ufw allow 3478/udp
   sudo ufw allow 5349/tcp
   sudo ufw allow 5349/udp
   sudo ufw allow 49152:65535/udp

5. Start service:
   sudo systemctl start coturn
   sudo systemctl status coturn

6. Test your TURN server:
   https://webrtc.github.io/samples/src/content/peerconnection/trickle-ice/

7. Update .env file:
   USE_OWN_STUN_SERVER=true
   STUN_SERVER_URL=stun:your-server.com:3478
   TURN_SERVER_URL=turn:your-server.com:3478
   TURNS_SERVER_URL=turns:your-server.com:5349
   TURN_USERNAME=meetify_user
   TURN_PASSWORD=your_secret_password

═══════════════════════════════════════════════════════════
`;

// ============================================
// Export
// ============================================

module.exports = {
  stunTurnConfig,
  getIceServers,
  getAllIceServers,
  getTwilioIceServers,
  getXirsysIceServers,
  getTurnServerStats,
  checkTurnServerHealth,
  installationGuide,
  
  // Helper function to print installation guide
  printInstallationGuide: () => {
    console.log(installationGuide);
  }
};