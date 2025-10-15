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

          // Setup handlers after connection
          this.setupHandlers();

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
      Utils.logDebug("📨 Received:", data.event || data.type, data);

      // Trigger event based on message structure
      if (data.event) {
        this.trigger(data.event, data.data || data);
      } else if (data.type) {
        this.trigger(data.type, data);
      } else {
        // Generic message
        this.trigger("message", data);
      }
    } catch (e) {
      Utils.logWarn("Failed to parse message:", event.data);
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

  // Send message to server
  emit(event, data) {
    if (!this.connected || !this.ws || this.ws.readyState !== WebSocket.OPEN) {
      Utils.logWarn("⚠️ Cannot send, WebSocket not connected:", event);
      return;
    }

    const message = JSON.stringify({
      event: event,
      data: data,
      timestamp: new Date().toISOString(),
    });

    try {
      this.ws.send(message);
      Utils.logDebug("📤 Sent:", event, data);
    } catch (e) {
      Utils.logError("Failed to send message:", e);
    }
  }

  // Close connection
  close() {
    if (this.ws) {
      this.ws.close(1000, "Client closing connection");
      this.connected = false;
    }
  }

  // Setup all game event handlers
  setupHandlers() {
    Utils.logInfo("Setting up game event handlers...");

    // Room events
    this.on("room_created", (data) => {
      Utils.logInfo("🏠 Room created:", data);
      gameState.setRoom(data.payload?.code || data.code);
      gameState.setPlayerId(data.payload?.room?.host || data.playerId);
      if (data.payload?.room) {
        gameState.setMaze(data.payload.room.maze);
        gameState.setTreasures(data.payload.room.treasures);
        gameState.updatePlayers(data.payload.room.players);
      }
      uiManager.showWaitingRoom(gameState.room);
      uiManager.updatePlayerList();
    });

    this.on("room_joined", (data) => {
      Utils.logInfo("🚪 Room joined:", data);
      gameState.setRoom(data.roomCode || data.code);
      gameState.setPlayerId(data.playerId);
      gameState.updatePlayers(data.players);
      if (data.maze) gameState.setMaze(data.maze);
      if (data.treasures) gameState.setTreasures(data.treasures);
      uiManager.showWaitingRoom(gameState.room);
      uiManager.updatePlayerList();
    });

    this.on("room_error", (data) => {
      Utils.logError("❌ Room error:", data);
      alert(data.message || "Erro ao entrar na sala");
    });

    // Player events
    this.on("player_joined", (data) => {
      Utils.logInfo("👤 Player joined:", data);
      if (data.players) {
        gameState.updatePlayers(data.players);
      } else if (data.player) {
        gameState.addPlayer(data.player);
      }
      uiManager.updatePlayerList();
    });

    this.on("player_left", (data) => {
      Utils.logInfo("👋 Player left:", data);
      if (data.players) {
        gameState.updatePlayers(data.players);
      } else if (data.playerId) {
        gameState.removePlayer(data.playerId);
      }
      uiManager.updatePlayerList();
      if (gameState.gameStarted) {
        playerManager.removePlayerEntity(data.playerId);
        uiManager.updateLeaderboard();
      }
    });

    this.on("player_ready", (data) => {
      Utils.logInfo("✅ Player ready:", data);
      if (data.players) {
        gameState.updatePlayers(data.players);
      } else if (data.playerId) {
        gameState.updatePlayerReady(data.playerId, data.ready);
      }
      uiManager.updatePlayerList();
    });

    // Game events
    this.on("game_starting", (data) => {
      Utils.logInfo("🎮 Game starting!", data);
      gameState.startGame(data);
      uiManager.hideLobby();
      gameController.initGame();
    });

    this.on("player_moved", (data) => {
      if (gameState.players[data.playerId]) {
        gameState.players[data.playerId].x = data.x;
        gameState.players[data.playerId].z = data.z;
        gameState.players[data.playerId].direction = data.direction;
        playerManager.updatePlayerEntity(data.playerId);
      }
    });

    this.on("treasure_collected", (data) => {
      Utils.logInfo("💎 Treasure collected:", data);
      gameController.handleTreasureCollection(data);
    });

    this.on("game_won", (data) => {
      Utils.logInfo("🏆 Game won!", data);
      gameController.handleGameWon(data);
    });

    // Expose socket globally
    window.socket = this;
    gameController.setSocket(this);
  }
}

// Expose globally
window.WSClient = WSClient;
