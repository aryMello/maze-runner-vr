// ========================================
// WEBSOCKET CLIENT (Refactored)
// Pure WebSocket connection management
// Event handling delegated to WSHandlers
// ========================================

class WSClient {
  constructor(server, path, isLocal) {
    this.server = server;
    this.path = path;
    this.isLocal = !!isLocal;
    this.ws = null;
    this.connected = false;
    this.listeners = {};
    this.id = null;
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 5;
    this.reconnectDelay = 2000;
  }

  // ========================================
  // CONNECTION MANAGEMENT
  // ========================================

  /**
   * Build WebSocket URL
   * @returns {string} - WebSocket URL
   */
  getWebSocketURL() {
    const norm = Utils.normalizeServer(this.server);
    const wsProto = norm.wsProto || "wss";
    const host = norm.host;
    const path = this.path.startsWith("/") ? this.path : "/" + this.path;
    return `${wsProto}://${host}${path}`;
  }

  /**
   * Connect to WebSocket server
   * @returns {Promise<WSClient>}
   */
  connect() {
    return new Promise((resolve, reject) => {
      try {
        const wsUrl = this.getWebSocketURL();
        Utils.logInfo("🔌 Connecting to WebSocket:", wsUrl);

        this.ws = new WebSocket(wsUrl);

        const timeout = setTimeout(() => {
          Utils.logError("⏰ WebSocket connection timeout (30s)");
          if (this.ws) {
            Utils.logInfo("📊 WebSocket state:", this.getState());
            this.ws.close();
          }
          reject(new Error("Connection timeout"));
        }, 30000); // Aumentado para 30 segundos

        this.ws.onopen = () => {
          clearTimeout(timeout);
          this.connected = true;
          this.reconnectAttempts = 0;
          this.id = "ws-" + Math.random().toString(36).substr(2, 9);
          Utils.logInfo("✅ WebSocket connected!", this.id);

          this.trigger("connect");
          resolve(this);
        };

        this.ws.onclose = (event) => {
          Utils.logInfo("🔌 WebSocket closed", event.code, event.reason);
          this.connected = false;
          this.trigger("disconnect", event.reason);

          // Attempt reconnection if not clean close
          if (event.code !== 1000 && this.reconnectAttempts < this.maxReconnectAttempts) {
            this.attemptReconnect();
          }
        };

        this.ws.onerror = (error) => {
          clearTimeout(timeout);
          Utils.logError("❌ WebSocket error:", error);
          this.trigger("error", error);
          this.trigger("connect_error", error);
          reject(error);
        };

        this.ws.onmessage = (event) => {
          this.handleMessage(event);
        };
      } catch (error) {
        Utils.logError("❌ Failed to create WebSocket:", error);
        reject(error);
      }
    });
  }

  /**
   * Close connection
   */
  close() {
    if (this.ws) {
      this.ws.close(1000, "Client closing connection");
      this.connected = false;
      Utils.logInfo("🔌 WebSocket connection closed");
    }
  }

  /**
   * Attempt to reconnect
   */
  attemptReconnect() {
    this.reconnectAttempts++;
    Utils.logInfo(`🔄 Reconnecting (${this.reconnectAttempts}/${this.maxReconnectAttempts})...`);

    setTimeout(() => {
      this.connect().catch((err) => {
        Utils.logError("❌ Reconnection failed:", err);
      });
    }, this.reconnectDelay * this.reconnectAttempts);
  }

  // ========================================
  // MESSAGE HANDLING
  // ========================================

  /**
   * Handle incoming message
   * @param {MessageEvent} event
   */
  handleMessage(event) {
    try {
      const data = JSON.parse(event.data);
      const eventType = data.event || data.type;

      Utils.logDebug("📨 Received:", eventType);

      // Trigger event listeners
      if (data.event) {
        this.trigger(data.event, data.data || data);
      } else if (data.type) {
        this.trigger(data.type, data);
      } else {
        this.trigger("message", data);
      }
    } catch (e) {
      Utils.logError("❌ Failed to parse message:", e);
      this.trigger("message", event.data);
    }
  }

  /**
   * Send message to server
   * @param {string} event - Event name
   * @param {object} data - Event data
   * @returns {boolean} - Success status
   */
  emit(event, data) {
    if (!this.ws) {
      Utils.logError("❌ Cannot send - WebSocket is null");
      return false;
    }

    if (this.ws.readyState !== WebSocket.OPEN) {
      Utils.logError(`❌ Cannot send - WebSocket not open (state: ${this.ws.readyState})`);
      return false;
    }

    const message = JSON.stringify({
      type: event,
      payload: data,
    });

    try {
      this.ws.send(message);
      Utils.logDebug("📤 Sent:", event);
      return true;
    } catch (e) {
      Utils.logError("❌ Failed to send message:", e);
      return false;
    }
  }

  // ========================================
  // EVENT LISTENERS
  // ========================================

  /**
   * Register event listener
   * @param {string} event - Event name
   * @param {function} callback - Callback function
   */
  on(event, callback) {
    if (!this.listeners[event]) {
      this.listeners[event] = [];
    }
    this.listeners[event].push(callback);
  }

  /**
   * Remove event listener
   * @param {string} event - Event name
   * @param {function} callback - Callback function (optional)
   */
  off(event, callback) {
    if (!this.listeners[event]) return;
    
    if (callback) {
      this.listeners[event] = this.listeners[event].filter((cb) => cb !== callback);
    } else {
      delete this.listeners[event];
    }
  }

  /**
   * Trigger event listeners
   * @param {string} event - Event name
   * @param {*} data - Event data
   */
  trigger(event, data) {
    if (this.listeners[event]) {
      this.listeners[event].forEach((callback) => {
        try {
          callback(data);
        } catch (e) {
          Utils.logError("❌ Error in event listener:", event, e);
        }
      });
    }
  }

  // ========================================
  // UTILITY METHODS
  // ========================================

  /**
   * Check if connected
   * @returns {boolean}
   */
  isConnected() {
    const isReady = this.ws && this.ws.readyState === WebSocket.OPEN;
    
    // Sync connected flag
    if (isReady && !this.connected) {
      this.connected = true;
    } else if (!isReady && this.connected) {
      this.connected = false;
    }
    
    return isReady;
  }

  /**
   * Get connection state
   * @returns {string}
   */
  getState() {
    if (!this.ws) return "CLOSED";
    
    const states = {
      [WebSocket.CONNECTING]: "CONNECTING",
      [WebSocket.OPEN]: "OPEN",
      [WebSocket.CLOSING]: "CLOSING",
      [WebSocket.CLOSED]: "CLOSED"
    };
    
    return states[this.ws.readyState] || "UNKNOWN";
  }
}

// Export
if (typeof module !== 'undefined' && module.exports) {
  module.exports = WSClient;
}

window.WSClient = WSClient;