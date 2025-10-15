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
      const eventType = data.event || data.type;

      // Log with formatted JSON
      Utils.logDebug("📨 Received:", eventType);
      console.log(JSON.stringify(data, null, 2));

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
      Utils.logInfo("🏠 Room created");

      const payload = data.payload || data;
      const room = payload.room || payload;

      // Set room code
      gameState.setRoom(payload.code || room.code);

      // Set player ID
      gameState.setPlayerId(room.host || payload.host);

      // Set maze, treasures and players data (store for later rendering)
      if (room.maze) {
        Utils.logInfo("🗺️ Setting maze from room_created");
        gameState.setMaze(room.maze);
      }

      if (room.treasures) {
        Utils.logInfo("💎 Setting treasures from room_created");
        gameState.setTreasures(room.treasures);
      }

      if (room.players) {
        Utils.logInfo("👥 Setting players from room_created");
        gameState.updatePlayers(room.players);
      }

      // Try to render after a short delay to ensure A-Frame scene is ready
      setTimeout(() => {
        if (gameState.maze && gameState.maze.length > 0) {
          Utils.logInfo("🎨 Rendering maze...");
          mazeRenderer.renderMaze();
        }

        if (gameState.treasures && gameState.treasures.length > 0) {
          Utils.logInfo("💎 Rendering treasures...");
          mazeRenderer.renderTreasures();
        }

        if (Object.keys(gameState.players).length > 0) {
          Utils.logInfo("🎮 Rendering player entities...");
          playerManager.updatePlayerEntities();
        }
      }, 500);

      uiManager.showWaitingRoom(gameState.room);
      uiManager.updatePlayerList();
    });

    this.on("room_joined", (data) => {
      Utils.logInfo("🚪 Room joined");

      const payload = data.payload || data;

      gameState.setRoom(payload.roomCode || payload.code);
      gameState.setPlayerId(payload.playerId);

      if (payload.players) {
        gameState.updatePlayers(payload.players);
      }

      if (payload.maze) {
        Utils.logInfo("🗺️ Setting maze from room_joined");
        gameState.setMaze(payload.maze);
      }

      if (payload.treasures) {
        Utils.logInfo("💎 Setting treasures from room_joined");
        gameState.setTreasures(payload.treasures);
      }

      // Try to render after a short delay to ensure A-Frame scene is ready
      setTimeout(() => {
        if (gameState.maze && gameState.maze.length > 0) {
          Utils.logInfo("🎨 Rendering maze...");
          mazeRenderer.renderMaze();
        }

        if (gameState.treasures && gameState.treasures.length > 0) {
          Utils.logInfo("💎 Rendering treasures...");
          mazeRenderer.renderTreasures();
        }

        if (Object.keys(gameState.players).length > 0) {
          Utils.logInfo("🎮 Rendering player entities...");
          playerManager.updatePlayerEntities();
        }
      }, 500);

      uiManager.showWaitingRoom(gameState.room);
      uiManager.updatePlayerList();
    });

    this.on("room_error", (data) => {
      Utils.logError("❌ Room error:", data);
      alert(data.message || "Erro ao entrar na sala");
    });

    // Player events
    this.on("player_joined", (data) => {
      Utils.logInfo("👤 Player joined");

      const payload = data.payload || data;

      if (payload.players) {
        gameState.updatePlayers(payload.players);
      } else if (payload.player) {
        gameState.addPlayer(payload.player);
      }

      // Render player entities if maze is loaded
      if (gameState.maze && gameState.maze.length > 0) {
        Utils.logInfo("🎮 Updating player entities after join...");
        playerManager.updatePlayerEntities();
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

    this.on("game_update", (data) => {
      Utils.logInfo("🔄 Game update received");

      // Update from payload
      const payload = data.payload || data;

      if (payload.maze) {
        Utils.logInfo("🗺️ Updating maze...");
        gameState.setMaze(payload.maze);

        // Render maze if not already rendered
        if (!mazeRenderer.rendered) {
          mazeRenderer.renderMaze();
        }
      }

      if (payload.treasures) {
        Utils.logInfo("💎 Updating treasures...");
        gameState.setTreasures(payload.treasures);

        // Render treasures if not already rendered
        if (!mazeRenderer.rendered) {
          mazeRenderer.renderTreasures();
        }
      }

      if (payload.players) {
        Utils.logInfo("👥 Updating players...");
        gameState.updatePlayers(payload.players);
        uiManager.updatePlayerList();

        // Update player entities if game started
        if (gameState.gameStarted) {
          Object.keys(payload.players).forEach((playerId) => {
            if (playerId !== gameState.myPlayerId) {
              playerManager.updatePlayerEntity(playerId);
            }
          });
          uiManager.updateLeaderboard();
        }
      }
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
