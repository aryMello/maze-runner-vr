// WebSocket Client - Native WebSocket Implementation
// Manages WebSocket connection with event handling

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

  // Build WebSocket URL
  getWebSocketURL() {
    const norm = Utils.normalizeServer(this.server);
    const wsProto = norm.wsProto || "wss";
    const host = norm.host;
    const path = this.path.startsWith("/") ? this.path : "/" + this.path;
    return `${wsProto}://${host}${path}`;
  }

  // Connect to WebSocket server
  connect() {
    return new Promise((resolve, reject) => {
      try {
        const wsUrl = this.getWebSocketURL();
        Utils.logInfo("Connecting to WebSocket:", wsUrl);

        this.ws = new WebSocket(wsUrl);

        const timeout = setTimeout(() => {
          Utils.logError("WebSocket connection timeout");
          this.ws.close();
          reject(new Error("Connection timeout"));
        }, 10000);

        this.ws.onopen = () => {
          clearTimeout(timeout);
          this.connected = true;
          this.reconnectAttempts = 0;
          this.id = "ws-" + Math.random().toString(36).substr(2, 9);
          Utils.logInfo("✅ WebSocket connected successfully!", this.id);

          uiManager.updateConnectionStatus("connected");
          this.trigger("connect");
          resolve(this);
        };

        this.ws.onclose = (event) => {
          Utils.logInfo("WebSocket closed", event.code, event.reason);
          this.connected = false;
          uiManager.updateConnectionStatus("disconnected");
          this.trigger("disconnect", event.reason);

          // Attempt reconnection if not a clean close
          if (
            event.code !== 1000 &&
            this.reconnectAttempts < this.maxReconnectAttempts
          ) {
            this.attemptReconnect();
          }
        };

        this.ws.onerror = (error) => {
          clearTimeout(timeout);
          Utils.logError("WebSocket error:", error);
          this.trigger("error", error);
          this.trigger("connect_error", error);
          reject(error);
        };

        this.ws.onmessage = (event) => {
          this.handleMessage(event);
        };
      } catch (error) {
        Utils.logError("Failed to create WebSocket:", error);
        reject(error);
      }
    });
  }

  // Handle incoming messages
  handleMessage(event) {
    try {
      const data = JSON.parse(event.data);
      const eventType = data.event || data.type;

      // Log with formatted JSON (compact maze as matrix)
      Utils.logInfo("📨 Received message - Event type:", eventType);
      Utils.logDebug("📨 Raw message structure:", {
        hasEvent: !!data.event,
        hasType: !!data.type,
        hasPayload: !!data.payload,
        hasData: !!data.data,
        eventType: eventType
      });

      // Create a copy for logging with compact maze
      const logData = JSON.parse(JSON.stringify(data));

      // Convert maze to compact matrix representation
      if (logData.payload?.room?.maze) {
        const maze = logData.payload.room.maze;
        const mazeString = maze.map((row) => row.join("")).join("\n");
        console.log(
          `🗺️ Maze (${maze.length}x${maze[0].length}):\n${mazeString}`
        );
        logData.payload.room.maze = `[${maze.length}x${maze[0].length} matrix - see above]`;
      }
      if (logData.payload?.maze) {
        const maze = logData.payload.maze;
        const mazeString = maze.map((row) => row.join("")).join("\n");
        console.log(
          `🗺️ Maze (${maze.length}x${maze[0].length}):\n${mazeString}`
        );
        logData.payload.maze = `[${maze.length}x${maze[0].length} matrix - see above]`;
      }

      console.log("📦 Message content:", JSON.stringify(logData, null, 2));

      // Trigger event based on message structure
      if (data.event) {
        Utils.logDebug("🎯 Triggering event:", data.event);
        this.trigger(data.event, data.data || data);
      } else if (data.type) {
        Utils.logDebug("🎯 Triggering type:", data.type);
        this.trigger(data.type, data);
      } else {
        // Generic message
        Utils.logWarn("⚠️ Message has no event or type, triggering generic 'message'");
        this.trigger("message", data);
      }
    } catch (e) {
      Utils.logError("❌ Failed to parse message:", e);
      Utils.logWarn("Raw message data:", event.data);
      this.trigger("message", event.data);
    }
  }

  // Attempt to reconnect
  attemptReconnect() {
    this.reconnectAttempts++;
    Utils.logInfo(
      `Attempting to reconnect (${this.reconnectAttempts}/${this.maxReconnectAttempts})...`
    );

    setTimeout(() => {
      this.connect().catch((err) => {
        Utils.logError("Reconnection failed:", err);
      });
    }, this.reconnectDelay * this.reconnectAttempts);
  }

  // Register event listener
  on(event, callback) {
    if (!this.listeners[event]) {
      this.listeners[event] = [];
    }
    this.listeners[event].push(callback);
  }

  // Remove event listener
  off(event, callback) {
    if (!this.listeners[event]) return;
    if (callback) {
      this.listeners[event] = this.listeners[event].filter(
        (cb) => cb !== callback
      );
    } else {
      delete this.listeners[event];
    }
  }

  // Trigger event listeners
  trigger(event, data) {
    if (this.listeners[event]) {
      this.listeners[event].forEach((callback) => {
        try {
          callback(data);
        } catch (e) {
          Utils.logError("Error in event listener:", event, e);
        }
      });
    }
  }

  // Check if WebSocket is truly connected and ready
  isConnected() {
    const isReady = this.ws && this.ws.readyState === WebSocket.OPEN;
    
    // Sync the connected flag with actual state
    if (isReady && !this.connected) {
      Utils.logWarn("⚠️ Syncing connected flag to true");
      this.connected = true;
    } else if (!isReady && this.connected) {
      Utils.logWarn("⚠️ Syncing connected flag to false");
      this.connected = false;
    }
    
    return isReady;
  }

  // Send message to server
  emit(event, data) {
    // Detailed connection check with logging
    Utils.logDebug("🔍 Checking connection state for emit:", {
      connected: this.connected,
      hasWs: !!this.ws,
      readyState: this.ws ? this.ws.readyState : 'no ws',
      readyStateExpected: WebSocket.OPEN,
      event: event
    });

    if (!this.ws) {
      Utils.logError("❌ Cannot send - WebSocket object is null");
      return false;
    }

    if (this.ws.readyState !== WebSocket.OPEN) {
      Utils.logError(`❌ Cannot send - WebSocket not open. State: ${this.ws.readyState} (OPEN=${WebSocket.OPEN})`);
      return false;
    }

    if (!this.connected) {
      Utils.logWarn("⚠️ Connected flag is false, but readyState is OPEN. Updating flag...");
      this.connected = true;
    }

    // Format message according to server expectations: {type, payload}
    const messageObj = {
      type: event,
      payload: data,
    };

    const message = JSON.stringify(messageObj);

    try {
      this.ws.send(message);
      Utils.logDebug("📤 Sent:", event);
      console.log(JSON.stringify(messageObj, null, 2));
      return true;
    } catch (e) {
      Utils.logError("Failed to send message:", e);
      return false;
    }
  }

  // Close connection
  close() {
    if (this.ws) {
      this.ws.close(1000, "Client closing connection");
      this.connected = false;
    }
  }
}

window.WSClient = WSClient;